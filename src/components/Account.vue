<script setup
        lang="ts">

import {onMounted, ref} from "vue";
import QrcodeVue from "qrcode.vue";
import config from "@/assets/config.json";
import {AES, aesKeyStore} from "@/aes.ts";
import {
  bytesToFileSizeString,
  decodeBase64Url,
  encodeBase64Url, getDateFromUnixTimestamp, getDateTimeString,
  isPasswordShitty,
  logout,
  refreshUserAccount,
  selectOnFocus,
  sha256
} from "@/util.ts";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {type BraindumpPasskey, braindumpStore} from "@/braindump.ts";
import StorageQuotaIndicator from "@/components/StorageQuotaIndicator.vue";

let busy = ref(false);
let enablingTotp = ref(false);
let disablingTotp = ref(false);
let changingEmail = ref(false);
let confirmDeletion = ref(false);
let copiedTotpSecret = ref(false);

let newEmail = ref('');
let newEmail2 = ref('');
let newEmailTotp = ref('');
let oldPassword = ref('');
let newPassword = ref('');
let newPassword2 = ref('');
let enableTotpCode = ref('');
let disableTotpCode = ref('');
let totpSecret = ref('');
let totpSecretQR = ref('');

let copyAnim: number;

const aes = new AES();

const textEncoder: TextEncoder = new TextEncoder();

onMounted(refreshUserAccount);

async function onClickChangePassword(): Promise<void>
{
  if (busy.value === true)
  {
    return;
  }

  if (!oldPassword.value)
  {
    alert('Current password field is empty.');
    return;
  }

  if (!newPassword.value)
  {
    alert('New password field is empty.');
    return;
  }

  if (isPasswordShitty(newPassword.value))
  {
    alert(`New password is too weak!

Please set a password that is at least ${Constants.MIN_PASSWORD_LENGTH} characters long and contains:

• at least 1 UPPERCASE letter
• at least 1 lowercase letter
• at least 1 special symbol
• at least 1 number.`);
    return;
  }

  if (newPassword.value !== newPassword2.value)
  {
    alert('New password and confirm new password fields do not match.');
    return;
  }

  busy.value = true;

  try
  {
    const oldPasswordHash = await sha256(oldPassword.value);
    const newPasswordHash = await sha256(newPassword.value);

    const pwModRequestContext = {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
      },
      body: JSON.stringify({
        OldPasswordHashSHA256: oldPasswordHash,
        NewPasswordHashSHA256: newPasswordHash,
      })
    };

    const response = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.CHANGE_PASSWORD}`,
        pwModRequestContext
    );

    if (!response.ok)
    {
      alert('Password modification request rejected. Please double-check your input and try again.');
      return;
    }

    localStorage.setItem(LocalStorageKeys.PASSWORD_HASH, newPasswordHash);

    console.log('Password modified successfully.');

    const aesKeyModRequestContext = {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
      },
      body: JSON.stringify({
        Private: true,
        Name: Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME,
        Notes: Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NOTES,
        Data: await aes.encryptString(aesKeyStore.aesKey, newPasswordHash)
      })
    };

    const aesKeyModResponse = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}/${aesKeyStore.encryptedAesKeyGuid}`,
        aesKeyModRequestContext
    );

    if (!aesKeyModResponse.ok)
    {
      console.error('FATAL ERROR! Password modification request was successful but re-encryption of the Braindump AES-256 key failed. Contact Braindump support team asap!');
    }

    alert('Password modified successfully. Please login again using your new, super fresh password! :D');
    localStorage.removeItem(LocalStorageKeys.PASSWORD_HASH);
    logout();
  }
  catch (e)
  {
    alert('Password modification request rejected. Please double-check your input and try again.');
  }
  finally
  {
    busy.value = false;
  }
}

async function onClickChangeEmail(): Promise<void>
{
  if (busy.value === true)
  {
    return;
  }

  busy.value = true;

  if (changingEmail.value === false)
  {
    if (!newEmail.value)
    {
      alert('New email address field is empty.');
      busy.value = false;
      return;
    }

    if (newEmail.value !== newEmail2.value)
    {
      alert('New email and confirm new email address fields do not match.');
      busy.value = false;
      return;
    }

    const emailModRequestContext = {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
      },
      body: JSON.stringify({
        NewEmail: newEmail.value.replace(/ /g, '')
      })
    };

    const response = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.CHANGE_EMAIL}`,
        emailModRequestContext
    );

    if (!response.ok)
    {
      switch (response.status)
      {
        case 403:
          alert('Email address modification request rejected because the domain is blacklisted.\n\nPlease do not use throwaway email service providers for this account!');
          newEmail.value = '';
          newEmail2.value = '';
          busy.value = false;
          return;
        case 409:
          alert(`Email address modification request rejected because the email address "${newEmail.value}" is already in use!`);
          newEmail.value = '';
          newEmail2.value = '';
          busy.value = false;
          return;
        default:
          alert('Email address modification request rejected. Please double-check your input and try again.');
          busy.value = false;
          return;
      }
    }

    busy.value = false;
    changingEmail.value = true;
  }
  else
  {
    if (!newEmailTotp.value)
    {
      alert('Confirmation code field empty.\n\nPlease enter the confirmation code that was sent to your new email address.');
      busy.value = false;
      return;
    }

    const emailModRequestContext = {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
      },
      body: JSON.stringify({
        NewEmail: newEmail.value.replace(/ /g, ''),
        Totp: newEmailTotp.value.replace(/ /g, '')
      })
    };

    const response = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.CHANGE_EMAIL_CONFIRM}`,
        emailModRequestContext
    );

    if (!response.ok)
    {
      switch (response.status)
      {
        case 409:
          alert(`Email address modification request rejected because the email address "${newEmail.value}" is already in use!`);
          newEmail.value = '';
          newEmail2.value = '';
          busy.value = false;
          return;
        default:
          alert('Email address modification request rejected. Please double-check your confirmation code and try again.');
          busy.value = false;
          return;
      }
    }

    busy.value = false;
    changingEmail.value = false;

    alert('Email address modified successfully. Please login again using your new credentials.');
    logout();
  }
}

async function onClickEnable2FA(): Promise<void>
{
  if (busy.value === true)
  {
    return;
  }

  busy.value = true;

  if (enablingTotp.value === false)
  {
    const requestContext = {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
      }
    };

    const response = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.ENABLE_2FA}`,
        requestContext
    );

    if (!response.ok)
    {
      alert(`Two-factor authentication activation request rejected. Error ${response.status} (${response.statusText})`);
      busy.value = false;
      return;
    }

    const responseBodyEnvelope = await response.json();

    if (!responseBodyEnvelope || responseBodyEnvelope.Type !== TypeNamesDTO.USER_ENABLE_2FA_RESPONSE_DTO || !responseBodyEnvelope.Items || responseBodyEnvelope.Items.length === 0)
    {
      alert(`Two-factor authentication activation request rejected. Error ${response.status} (${response.statusText}).`);
      busy.value = false;
      return;
    }

    busy.value = false;
    enablingTotp.value = true;
    totpSecret.value = responseBodyEnvelope.Items[0].TotpSecret;
    totpSecretQR.value = `otpauth://totp/Braindump?secret=${totpSecret.value}`;
  }
  else
  {
    const requestContext = {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
      },
      body: JSON.stringify({
        Totp: enableTotpCode.value.replace(/ /g, '')
      })
    };

    const response = await fetch
    (
        `${config.BackendBaseURL}${EndpointURLs.ENABLE_2FA_CONFIRM}`,
        requestContext
    );

    if (!response.ok)
    {
      alert(`Two-factor authentication activation failed. Please double-check your input and try again.`);
      busy.value = false;
      return;
    }

    busy.value = false;
    totpSecret.value = '';
    totpSecretQR.value = '';
    enableTotpCode.value = '';
    enablingTotp.value = false;
    disablingTotp.value = false;

    alert('Two-factor authentication has been enabled successfully for your user account. Kudos for improving your opsec! 😃');
    await refreshUserAccount();
  }
}

async function onClickDisable2FA(): Promise<void>
{
  if (busy.value === true)
  {
    return;
  }

  if (disablingTotp.value === false)
  {
    disableTotpCode.value = '';
    disablingTotp.value = true;
    return;
  }

  if (!confirm('Are you sure?\n\nTwo-Factor Authentication adds a considerable amount of security to your account.\n\nDisabling 2FA will decrease your account\'s security!'))
  {
    disablingTotp.value = false;
    return;
  }

  busy.value = true;

  const requestContext = {
    method: 'PUT',
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
    },
    body: JSON.stringify({
      Totp: disableTotpCode.value.replace(/ /g, '')
    })
  };

  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DISABLE_2FA}`,
      requestContext
  );

  if (!response.ok)
  {
    alert(`Two-factor authentication deactivation request rejected. Please double-check your input and try again.`);
    busy.value = false;
    return;
  }

  alert('Two-factor authentication has been disabled successfully for your user account. Consider re-enabling it soon!');

  busy.value = false;
  enablingTotp.value = false;
  disablingTotp.value = false;

  await refreshUserAccount();
}

function onClickCopyTotpSecret(): void
{
  if (!totpSecret.value)
  {
    return;
  }

  navigator.clipboard.writeText(totpSecret.value);

  copiedTotpSecret.value = true;

  if (copyAnim)
  {
    window.clearTimeout(copyAnim);
  }

  copyAnim = window.setInterval(() =>
  {
    copiedTotpSecret.value = false;
  }, 2048);

  setTimeout(() => alert('2FA secret has been copied to clipboard.\n\nCAREFUL! Do not send this to anyone.\n\nBack it up somewhere safe (maybe in a password manager like Bitwarden?)'), 64);
}

async function onClickRegisterNewPasskey(): Promise<void>
{
  if (busy.value === true)
  {
    return;
  }

  if (braindumpStore.user?.TotpEnabled === false)
  {
    alert('Passkeys are only allowed when 2FA is enabled!');
    return;
  }

  const unsupportedErrorMessage: string = 'Passkeys via WebAuthN are not supported on this browser.';

  const publicKeyCredentialSupported: Boolean = typeof PublicKeyCredential !== 'undefined';

  if (!publicKeyCredentialSupported)
  {
    alert(unsupportedErrorMessage);
    return;
  }

  const displayName: string | null = prompt('Give your passkey a recognizable display name, like for example your username combined with the name of your password manager (the one used for generating the passkey) or the authentication device.', '');

  if (!displayName)
  {
    alert(displayName === null ? 'Passkey registration cancelled.' : 'Please enter a display name for your passkey.');
    return;
  }

  if (displayName.length > 64)
  {
    alert('Display name too long.');
    return;
  }

  busy.value = true;

  const requestContext = {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
    }
  };

  const displayNameBase64URL: string = encodeBase64Url(textEncoder.encode(displayName));

  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.PASSKEYS}?displayNameBase64URL=${displayNameBase64URL}`,
      requestContext
  );

  if (!response.ok)
  {
    alert(`Passkey registration failed. Error: ${response.status} (${response.statusText})`);
    busy.value = false;
    return;
  }

  const responseBodyEnvelope = await response.json();

  if (!responseBodyEnvelope.Items || responseBodyEnvelope.Items.length !== 1)
  {
    alert('Failed to initialize new passkey registration.');
    busy.value = false;
    return;
  }

  try
  {
    let credentialCreationContext = responseBodyEnvelope.Items[0];

    credentialCreationContext.challenge = decodeBase64Url(credentialCreationContext.challenge);
    credentialCreationContext.user.id = decodeBase64Url(credentialCreationContext.user.id);

    const credential = await navigator.credentials.create({publicKey: credentialCreationContext}) as PublicKeyCredential;

    if (!credential)
    {
      alert(unsupportedErrorMessage);
      return;
    }

    const attestationResponse = {
      id: credential.id,
      rawId: encodeBase64Url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: encodeBase64Url((credential.response as AuthenticatorAttestationResponse).attestationObject),
        clientDataJSON: encodeBase64Url(credential.response.clientDataJSON)
      }
    };

    const response = await fetch(`${config.BackendBaseURL}${EndpointURLs.PASSKEYS_REGISTER}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`
      },
      body: JSON.stringify(attestationResponse)
    });

    if (!response.ok)
    {
      alert('Failed to initialize new passkey registration.');
      return;
    }

    await refreshUserAccount();
  }
  catch (e)
  {
    alert('Passkey registration cancelled or failed.');
  }
  finally
  {
    busy.value = false;
  }
}

async function onClickRenamePasskey(passkey: BraindumpPasskey): Promise<void>
{
  const displayName: string | null = prompt('Give your passkey a fresh, new and recognizable display name, like for example your username combined with the name of your password manager (the one used for generating the passkey) or the authentication device.', '');

  if (!displayName)
  {
    alert(displayName === null ? 'Passkey renaming cancelled.' : 'Please enter a new display name for your passkey.');
    return;
  }

  if (displayName.length > 64)
  {
    alert('Display name too long.');
    return;
  }

  const newDisplayNameBase64URL: string = encodeBase64Url(textEncoder.encode(displayName));

  const response = await fetch(`${config.BackendBaseURL}${EndpointURLs.PASSKEYS}/${passkey.Guid}?newDisplayNameBase64URL=${newDisplayNameBase64URL}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`
    }
  });

  if (!response.ok)
  {
    alert('Failed to rename passkey.');
    return;
  }

  await refreshUserAccount();
}

async function onClickDeletePasskey(passkey: BraindumpPasskey): Promise<void>
{
  if (!confirm(`Are you sure that you want to delete the passkey "${passkey.DisplayName}"?`))
  {
    return;
  }

  const response = await fetch(`${config.BackendBaseURL}${EndpointURLs.PASSKEYS}/${passkey.Guid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`
    }
  });

  if (!response.ok)
  {
    alert('Failed to delete passkey.');
    return;
  }

  await refreshUserAccount();
}

async function onClickDeleteAccount(): Promise<void>
{
  if (busy.value === true)
  {
    return;
  }

  busy.value = true;

  if (!confirm('Are you sure? This is irreversible: it cannot be undone!'))
  {
    busy.value = false;
    return;
  }

  if (!confirm('Are you ABSOLUTELY sure?\n\nLast warning!\n\nYour user account and all of your braindumps and data will be deleted immediately.'))
  {
    busy.value = false;
    return;
  }

  const requestContext = {
    method: 'DELETE',
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
    }
  };

  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.USERS}`,
      requestContext
  );

  if (!response.ok)
  {
    alert(`User deletion request failed. Error: ${response.status} (${response.statusText})`);
    busy.value = false;
    return;
  }

  alert('User account has been deleted successfully.');
  localStorage.removeItem(LocalStorageKeys.PASSWORD_HASH);
  logout();
}

</script>

<template>

  <div class="page-title">

    <div class="row">

      <div class="col-lg-8 order-md-1 order-last">

        <h3>
          Account
        </h3>

        <p class="text-subtitle text-muted">
          Manage your Braindump account here and perform security improvements, such as
          changing your password or enabling 2FA (that's a great idea, seriously! Always use 2FA wherever
          possible!).
        </p>

        <StorageQuotaIndicator />

      </div>

    </div>

  </div>

  <section class="section"
           style="margin-top: 16px;">

    <div class="row"
         style="justify-content: center;">

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">

            <h5 class="card-title">
              Change Password
            </h5>

          </div>

          <div class="card-body">

            <div class="form-group my-2">

              <label for="current_password"
                     class="form-label">
                Current password
              </label>

              <input type="password"
                     name="current-password"
                     id="current-password"
                     class="form-control"
                     v-model="oldPassword"
                     v-on:keyup.enter="onClickChangePassword();"
                     placeholder="Enter your current password"
                     value="">
            </div>

            <div class="form-group my-2">

              <label for="new-password"
                     class="form-label">
                New password
              </label>

              <input type="password"
                     name="new-password"
                     id="new-password"
                     class="form-control"
                     v-model="newPassword"
                     placeholder="Enter new password"
                     v-on:keyup.enter="onClickChangePassword();"
                     value="">
            </div>

            <div class="form-group my-2">

              <label for="confirm-password"
                     class="form-label">
                Confirm new password
              </label>

              <input type="password"
                     name="confirm-password"
                     id="confirm-password"
                     class="form-control"
                     v-model="newPassword2"
                     v-on:keyup.enter="onClickChangePassword();"
                     placeholder="Re-enter new password"
                     value="">
            </div>

            <div style="margin-top: 32px;"></div>

            <div class="form-group my-2 d-flex justify-content-end">

              <button type="button"
                      :disabled="busy"
                      @click="onClickChangePassword"
                      class="btn btn-primary bdmp-button">
                Save
              </button>

            </div>


          </div>

        </div>

      </div>

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">
            <h5 class="card-title">
              Change Email
            </h5>
          </div>

          <div class="card-body">

            <div class="form-group my-2">

              <label for="email"
                     class="form-label">
                Current email
              </label>

              <input type="email"
                     name="email"
                     id="email"
                     class="form-control"
                     placeholder="Enter your current email"
                     readonly
                     :value="braindumpStore.user?.Email">
            </div>

            <div class="form-group my-2">

              <label for="email"
                     class="form-label">
                New email
              </label>

              <input type="email"
                     name="email"
                     id="email"
                     class="form-control"
                     v-model="newEmail"
                     :readonly="changingEmail"
                     v-on:keyup.enter="onClickChangeEmail();"
                     placeholder="Enter your new email address">
            </div>

            <div class="form-group my-2">

              <label for="email"
                     class="form-label">
                Confirm new email
              </label>

              <input type="email"
                     name="email"
                     id="email"
                     class="form-control"
                     v-model="newEmail2"
                     :readonly="changingEmail"
                     v-on:keyup.enter="onClickChangeEmail();"
                     placeholder="Re-enter your new email address">
            </div>

            <div class="form-group my-2"
                 v-if="changingEmail">

              <label for="email"
                     class="form-label">
                Confirmation code
              </label>

              <input type="text"
                     maxlength="8"
                     class="form-control"
                     v-model="newEmailTotp"
                     v-on:keyup.enter="onClickChangeEmail();"
                     placeholder="Please enter the confirmation code that was sent to your new email address">
            </div>


            <div style="margin-top: 32px;"></div>

            <div class="form-group my-2 d-flex justify-content-end">

              <button type="button"
                      :disabled="busy"
                      @click="onClickChangeEmail"
                      class="btn btn-primary bdmp-button">
                Save
              </button>

            </div>

          </div>

        </div>

      </div>

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">
            <h5 class="card-title">
              Two-Factor Authentication
            </h5>
          </div>

          <div class="card-body"
               v-if="braindumpStore.user?.TotpEnabled === false">

            <p v-if="!enablingTotp">
              Great idea!
              <br />
              <br />
              In fact, Two-Factor Authentication adds a substantial layer of security to your user account.
              <br />
              To find out more about what 2FA is, check out its
              <a href="https://en.wikipedia.org/wiki/Multi-factor_authentication"
                 target="_blank">
                Wikipedia article
              </a>.
            </p>

            <div v-else>

              <p>
                The following is your 2FA secret. <strong>It will never be displayed again.</strong> Please store it
                somewhere safe!
                If you lose it and your 2FA-device, you lose access to your user account!
              </p>

              <p>
                Manually enter your 2FA secret into a multi-factor auth app of your choice
                (e.g.
                <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                   target="_blank">
                  Google Authenticator
                </a>
                or the free, open-source
                <a href="https://tfacgui.glitchedpolygons.com/"
                   target="_blank">
                  TFACGUI</a>),
                or scan the following QR-code with it.
              </p>

              <div class="totp-secret">

                <div class="input-group mb-3 mt-3"
                     style="max-width: 512px">

                  <button class="btn btn-primary"
                          type="button"
                          :disabled="!totpSecret"
                          @click="onClickCopyTotpSecret">

                    <i class="bi bi-copy"
                       v-if="!copiedTotpSecret"></i>

                    <i class="bi bi-check-circle"
                       v-if="copiedTotpSecret"></i>

                  </button>

                  <input type="text"
                         maxlength="8"
                         id="totp-secret"
                         name="totp-secret"
                         class="form-control"
                         style="cursor: default;"
                         :value="totpSecret"
                         @focus="selectOnFocus"
                         readonly>

                </div>

              </div>

              <div class="totp-secret-qr">

                <qrcode-vue
                    :value="totpSecretQR"
                    style="border-radius: 4px"
                    :margin="2"
                    :size="280"
                    :render-as="'svg'"
                    :level="'M'" />

              </div>

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-center">

                <input type="text"
                       name="totp-enable-code"
                       maxlength="8"
                       style="max-width: 285px;"
                       class="form-control"
                       v-model="enableTotpCode"
                       :readonly="busy"
                       v-on:keyup.enter="onClickEnable2FA();"
                       placeholder="Enter a valid TOTP">
              </div>

            </div>

            <div style="margin-top: 32px;"></div>

            <div :class="`form-group my-2 d-flex ${enablingTotp ? 'justify-content-center' : 'justify-content-end'}`">

              <button type="submit"
                      :disabled="busy"
                      id="enable-2fa-button"
                      @click="onClickEnable2FA"
                      class="btn btn-success bdmp-button">
                Enable two-factor authentication
              </button>

            </div>

          </div>

          <div class="card-body"
               v-else>

            <div v-if="!disablingTotp">
              <p>
                2FA is currently enabled for your account. You can disable it here by entering a valid TOTP one last
                time and switching back to plain user+password authentication.
              </p>

            </div>

            <div v-else>

              <div class="form-group my-2 d-flex justify-content-center">

                <input type="text"
                       name="totp-enable-code"
                       maxlength="8"
                       style="max-width: 287px;"
                       class="form-control"
                       v-model="disableTotpCode"
                       :readonly="busy"
                       v-on:keyup.enter="onClickDisable2FA();"
                       placeholder="Enter a valid TOTP">
              </div>

            </div>

            <div style="margin-top: 32px;"></div>

            <div :class="`form-group my-2 d-flex ${disablingTotp ? 'justify-content-center' : 'justify-content-end'}`">

              <button type="submit"
                      :disabled="busy"
                      @click="onClickDisable2FA"
                      id="disable-2fa-button"
                      class="btn btn-danger bdmp-button">
                Disable two-factor authentication
              </button>

            </div>

          </div>

        </div>

      </div>

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">
            <h5 class="card-title">
              Passkeys
            </h5>
          </div>

          <div class="card-body"
               v-if="braindumpStore.user?.TotpEnabled === true">

            <p>
              <a target="_blank"
                 href="https://www.passkeys.com/what-are-passkeys">Passkeys</a> are a great and modern way to harden
              your account's security whilst going passwordless.<br>
              Please note that Braindump's passkey login is only available after having logged in <i>traditionally</i>
              (by entering your username and password) at least once, since everything is client-side encrypted using
              your password.
            </p>

            <div v-if="braindumpStore.user.PasskeysJson">

              <ul class="list-group"
                  v-for="passkey in JSON.parse(braindumpStore.user.PasskeysJson)">

                <li class="list-group-item d-flex justify-content-between align-items-center">

                  <span>
                    {{
                      passkey.DisplayName
                    }}, last used: {{ getDateTimeString(getDateFromUnixTimestamp(passkey.LastUsageTimestampUTC), true) }}
                  </span>

                  <div class="passkeys-buttons">

                    <span @click="onClickRenamePasskey(passkey)"
                          class="badge bg-info badge-pill badge-round ms-1 unselectable"
                          title="Change this passkey's display name">
                      Rename
                    </span>

                    <span @click="onClickDeletePasskey(passkey)"
                          class="badge bg-danger badge-pill badge-round ms-1 unselectable"
                          title="Delete this passkey, making it immediately unavailable as an authentication method">
                      Delete
                    </span>

                  </div>
                </li>

              </ul>

            </div>
            <div class="card-body"
                 v-else>
              <p>
                No passkeys registered yet. More information available on: <a target="_blank"
                                                                              href="https://passkeys.com">https://passkeys.com</a>
              </p>
            </div>

            <div style="margin-top: 32px;"></div>

            <div class="form-group my-2 d-flex justify-content-end">

              <button type="button"
                      :disabled="busy"
                      @click="onClickRegisterNewPasskey"
                      id="register-passkey-button"
                      class="btn btn-success bdmp-button">
                Register new passkey
              </button>

            </div>

          </div>

          <div class="card-body"
               v-else>
            <p>
              <a target="_blank"
                 href="https://www.passkeys.com/what-are-passkeys">FIDO2 passkeys</a> are only allowed for user accounts
              with 2FA enabled.
              <br><br>
              If you wish to make use of passkey based login, please activate two-factor authentication first.
              <br><br>
              Disabling 2FA after registering one or more passkeys will not delete them, but rather ignore all passkey
              based login attempts until 2FA is back on.
            </p>
          </div>

        </div>

      </div>

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">

            <h5 class="card-title">
              Delete Account
            </h5>

          </div>

          <div class="card-body">

            <p>
              Your account will be permanently deleted and cannot be restored. Tick the checkbox below to proceed...
            </p>

            <div class="form-check">

              <div class="checkbox">

                <input type="checkbox"
                       id="checkbox-confirm-account-deletion"
                       v-model="confirmDeletion"
                       class="form-check-input">

                <label for="checkbox-confirm-account-deletion"
                       unselectable="on"
                       class="unselectable">
                  Confirm permanent deletion
                </label>
              </div>
            </div>

            <div style="margin-top: 32px;"></div>

            <div class="form-group my-2 d-flex justify-content-end">

              <button type="submit"
                      class="btn btn-danger bdmp-button"
                      id="btn-delete-account"
                      @click="onClickDeleteAccount"
                      :disabled="busy || !confirmDeletion">
                Delete
              </button>

            </div>

          </div>
        </div>
      </div>
    </div>
  </section>

</template>

<style scoped>

.row {
  justify-content: center;
}

#enable-2fa-button {
  max-width: 285px;
}

#disable-2fa-button {
  max-width: 300px;
}

@media (max-width: 512px) {
  button {
    width: 100%;
  }

  #enable-2fa-button, #disable-2fa-button {
    padding-left: 4px !important;
    padding-right: 4px !important;
  }
}

.totp-secret {
  margin-right: 24px;
  margin-left: 24px;
  display: flex;
  justify-content: center;
}

.totp-secret-qr {
  display: flex;
  justify-content: center;
  margin-top: 28px;
  margin-bottom: 32px;
}

html[data-bs-theme="dark"] .list-group {
  --bs-list-group-border-color: rgba(193, 193, 193, 0.11);
}

.passkeys-buttons {
  display: flex;
  gap: 4px;
}

.passkeys-buttons > span {
  min-width: 32px;
  cursor: pointer;
}

.passkeys-buttons > span:hover {
  filter: brightness(90%);
}

</style>