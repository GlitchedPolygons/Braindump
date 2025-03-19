<script setup
        lang="ts">

import {onMounted, ref} from "vue";
import QrcodeVue from "qrcode.vue";
import config from "@/assets/config.json";
import {AES, aesKeyStore} from "@/aes.ts";
import {isPasswordShitty, logout, selectOnFocus, sha256} from "@/util.ts";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";

let busy = ref(false);
let enablingTotp = ref(false);
let disablingTotp = ref(false);
let changingEmail = ref(false);
let confirmDeletion = ref(false);
let copiedTotpSecret = ref(false);

let user = ref();
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

onMounted(async () =>
{
  await refreshUserAccount();
});

async function refreshUserAccount(): Promise<void>
{
  const requestContext = {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
    },
  };

  const response: Response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.ME}`,
      requestContext
  );

  if (!response.ok)
  {
    logout();
  }

  const responseBody = await response.json();

  if (!responseBody || responseBody.Type !== TypeNamesDTO.USER_RESPONSE_DTO || responseBody.Items.length === 0)
  {
    logout();
  }

  user.value = responseBody.Items[0];
}

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
    alert('New password is too weak!\n\nPlease set a password that is at least 7 characters long and contains:\n\n• at least 1 UPPERCASE letter\n• at least 1 lowercase letter\n• at least 1 number.');
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

      </div>

    </div>

  </div>

  <section class="section">

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
                     :value="user?.Email">
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
               v-if="user?.TotpEnabled === false">

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

</style>