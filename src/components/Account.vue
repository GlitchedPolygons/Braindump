<script setup
        lang="ts">

import {onMounted, ref} from "vue";
import config from "@/assets/config.json";
import {Constants, EndpointURLs, LocalStorageKeys} from "@/constants.ts";
import {arrayBufferToHexEncodedString, isPasswordShitty, logout, sha256} from "@/util.ts";
import {AES, aesKeyStore} from "@/aes.ts";

let confirmDeletion = ref(false);
let user = ref();
let newEmail = ref('');
let newEmail2 = ref('');
let oldPassword = ref('');
let newPassword = ref('');
let newPassword2 = ref('');
let busy = ref(false);

const aes = new AES();
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

onMounted(async () =>
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

  if (!responseBody || responseBody.Type !== 'UserResponseDto' || responseBody.Items.length === 0)
  {
    logout();
  }

  user.value = responseBody.Items[0];
});

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

function onClickChangeEmail(): void
{
  if (!newEmail.value)
  {
    alert('New email address field is empty.');
    return;
  }

  if (newEmail.value !== newEmail2.value)
  {
    alert('New email and confirm new email address fields do not match.');
    return;
  }

  //todo
}

function onClickDeleteAccount(): void
{
  // todo: impl
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

      <!--
      <div class="col-12 col-md-6 order-md-2 order-first">
        <nav aria-label="breadcrumb"
             class="breadcrumb-header float-start float-lg-end">
          <ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="index.html">Dashboard</a></li>
            <li class="breadcrumb-item active"
                aria-current="page">Security
            </li>
          </ol>
        </nav>
      </div>
      -->

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

            <form action="#"
                  method="get">

              <div class="form-group my-2">

                <label for="current_password"
                       class="form-label">
                  Current password
                </label>

                <input type="password"
                       name="current_password"
                       id="current_password"
                       class="form-control"
                       v-model="oldPassword"
                       placeholder="Enter your current password"
                       value="">
              </div>

              <div class="form-group my-2">

                <label for="password"
                       class="form-label">
                  New password
                </label>

                <input type="password"
                       name="password"
                       id="password"
                       class="form-control"
                       v-model="newPassword"
                       placeholder="Enter new password"
                       value="">
              </div>

              <div class="form-group my-2">

                <label for="confirm_password"
                       class="form-label">
                  Confirm new password
                </label>

                <input type="password"
                       name="confirm_password"
                       id="confirm_password"
                       class="form-control"
                       v-model="newPassword2"
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

            </form>

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
                     style="cursor: not-allowed;"
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
                     placeholder="Re-enter your new email address">
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

          <div class="card-body">

            <div class="form-group my-2">

              <label for="email"
                     class="form-label">
                Current Email
              </label>

              <input type="email"
                     name="email"
                     id="email"
                     class="form-control"
                     placeholder="Enter your current email"
                     value="john.doe@example.net">
            </div>

            <div style="margin-top: 32px;"></div>

            <div class="form-group my-2 d-flex justify-content-end">

              <button type="submit"
                      :disabled="busy"
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
              Delete Account
            </h5>

          </div>

          <div class="card-body">

            <form action="#"
                  method="get">

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

            </form>
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

</style>