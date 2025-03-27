<script setup
        lang="ts">

import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import config from "@/assets/config.json";
import {onMounted, type Ref, ref} from "vue";
import {braindumpStore} from "@/braindump.ts";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {getUnixTimestamp, refreshUserAccount, selectOnFocus, sha256} from "@/util.ts";

declare var bootstrap: any;

let logoSrc = ref('');

let loggingIn: Ref<boolean, boolean> = ref(false);

let saveDefibrillatorToken: boolean = false;

const username: Ref<string, string> = ref('');
const password: Ref<string, string> = ref('');
const totp: Ref<string, string> = ref('');

const emit = defineEmits(['onLoginSuccessful']);

onMounted(async () =>
{
  const lastUsername = localStorage.getItem(LocalStorageKeys.LAST_USERNAME);

  if (lastUsername)
  {
    username.value = lastUsername;
  }

  logoSrc.value = config.LoginLogoURL;
});

function onChangeSaveDefibrillatorToken()
{
  localStorage.setItem(LocalStorageKeys.SAVE_DEFIBRILLATOR_TOKEN, saveDefibrillatorToken.toString());
}

async function login()
{
  if (loggingIn.value || !username.value || !password.value)
  {
    return;
  }

  loggingIn.value = true;

  const passwordHash = await sha256(password.value);

  const requestContext = {
    method: 'POST',
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      Email: username.value,
      PasswordHashSHA256: passwordHash,
      Totp: totp.value && totp.value.length !== 0 ? totp.value : null,
    })
  };

  fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.LOGIN}`,
      requestContext
  ).then(response =>
  {
    if (!response.ok)
    {
      onLoginFailed();
      setTimeout(() => loggingIn.value = false, 1024);
      return;
    }

    onChangeSaveDefibrillatorToken();

    response.json().then(responseBodyEnvelope =>
    {
      setTimeout(() => loggingIn.value = false, 1024);

      if (responseBodyEnvelope.Type === TypeNamesDTO.LOGIN_RESPONSE_DTO && responseBodyEnvelope.Items && responseBodyEnvelope.Items.length !== 0)
      {
        const loginResponseDto = responseBodyEnvelope.Items[0];

        const utcNow: number = getUnixTimestamp();

        localStorage.setItem(LocalStorageKeys.PASSWORD_HASH, passwordHash);
        localStorage.setItem(LocalStorageKeys.AUTH_TOKEN, loginResponseDto.Token);
        localStorage.setItem(LocalStorageKeys.LAST_USERNAME, username.value);
        localStorage.setItem(LocalStorageKeys.LAST_AUTH_TOKEN_REFRESH_UTC, utcNow.toString());

        if (saveDefibrillatorToken)
        {
          localStorage.setItem(LocalStorageKeys.DEFIBRILLATOR_TOKEN, loginResponseDto.DefibrillatorToken);
        }

        braindumpStore.defibrillatorToken = loginResponseDto.DefibrillatorToken;

        emit('onLoginSuccessful');

        braindumpStore.workingOffline = false;

        refreshUserAccount();
      }
      else
      {
        onLoginFailed();
      }
    })
  }).catch(error =>
  {
    onLoginFailed();
    setTimeout(() => loggingIn.value = false, 1024);
  });
}

function onLoginFailed(): void
{
  password.value = '';
  totp.value = '';

  new bootstrap.Toast(document.getElementById('toast-login-failed')).show();
}

function onClickWorkOffline(): void
{
  braindumpStore.workingOffline = true;
}

</script>

<template>

  <div id="auth">

    <div class="row h-100">
      <div class="col-lg-5 col-12">
        <div id="auth-left">

          <div class="auth-logo"
               style="margin-bottom: 5.0rem;">

            <a href="javascript:void(0);">
              <img :src="logoSrc"
                   alt=""></a>

          </div>

          <h1 class="auth-title unselectable">
            Login
          </h1>

          <p class="auth-subtitle mb-5 unselectable">
            Enter your credentials and start dumping.
          </p>

          <div>

            <div class="form-group position-relative has-icon-left mb-4">

              <input type="text"
                     class="form-control form-control-xl"
                     v-model="username"
                     v-on:keyup.enter="login();"
                     @focus="selectOnFocus"
                     placeholder="Username">

              <div class="form-control-icon">
                <i class="bi bi-person"></i>
              </div>

            </div>

            <div class="form-group position-relative has-icon-left mb-4">

              <input type="password"
                     class="form-control form-control-xl"
                     v-model="password"
                     v-on:keyup.enter="login();"
                     @focus="selectOnFocus"
                     placeholder="Password">

              <div class="form-control-icon">

                <i class="bi bi-shield-lock"></i>

              </div>

            </div>

            <div class="form-group position-relative has-icon-left mb-4">

              <input type="text"
                     class="form-control form-control-xl"
                     v-model="totp"
                     v-on:keyup.enter="login();"
                     @focus="selectOnFocus"
                     placeholder="Two-Factor Authentication">

              <div class="form-control-icon">
                <i class="bi bi-key"></i>
              </div>

            </div>

            <div class="form-check form-check-lg d-flex align-items-end">

              <input class="form-check-input me-2"
                     type="checkbox"
                     v-model="saveDefibrillatorToken"
                     v-on:change="onChangeSaveDefibrillatorToken();"
                     id="checkbox-remember-me">

              <label class="form-check-label text-gray-600 unselectable"
                     for="checkbox-remember-me">
                Keep me logged in
              </label>

            </div>

            <button class="btn btn-primary btn-block btn-lg shadow-lg mt-5"
                    type="submit"
                    :disabled="loggingIn || !username || !password"
                    v-on:click="login();">
              {{ loggingIn ? 'Logging in...' : 'Login' }}
            </button>

          </div>

          <div class="toast"
               id="toast-login-failed"
               style="margin-top: 32px; width: 100%;"
               data-bs-delay="8192"
               data-bs-autohide="false"
               role="alert"
               aria-live="assertive"
               aria-atomic="true">

            <div class="toast-header">

              <svg class="bd-placeholder-img rounded me-2"
                   width="20"
                   height="20"
                   xmlns="http://www.w3.org/2000/svg"
                   preserveAspectRatio="xMidYMid slice"
                   aria-hidden="true"
                   focusable="false">

                <rect width="100%"
                      height="100%"
                      fill="#ff0000"></rect>
              </svg>

              <strong class="me-auto">
                Error
              </strong>

              <small>
                401
              </small>

              <button type="button"
                      class="btn-close"
                      style="filter: none;"
                      data-bs-dismiss="toast"
                      aria-label="Close"></button>
            </div>

            <div class="toast-body">
              Login attempt failed. Please ensure that your credentials are correct or try again later!
            </div>
          </div>

          <div class="text-center mt-5 text-lg fs-4">

            <p class="text-gray-600 unselectable">
              Don't have an account?
              <a :href="Constants.SIGN_UP_URL"
                 class="font-bold signup-link">
                Sign up
              </a>
            </p>

            <!--            -->
            <!--            <p>-->
            <!--              <a class="font-bold"-->
            <!--                 href="auth-forgot-password.html">-->
            <!--                Forgot password?-->
            <!--              </a>-->
            <!--            </p>-->
            <!--            -->

          </div>

          <ThemeSwitcher />

          <br />
          <br />
          <br />

          <a href="javascript:void(0);"
             @click="onClickWorkOffline"
             class="font-bold signup-link work-offline-link">
            Work offline
          </a>

        </div>
      </div>

      <div class="col-lg-7 d-none d-lg-block">
        <div id="auth-right">
          <!-- nop -->
        </div>
      </div>
    </div>
  </div>

</template>

<style scoped>

body {
  background-color: var(--bs-body-bg)
}

#auth {
  height: 100vh;
  overflow-x: hidden
}

#auth #auth-right {
  height: 100%;
  background: url('https://mazer-template.pages.dev/demo/assets/compiled/png/4853433.png'), linear-gradient(69deg, #2d6e9d, #423f91)
}

#auth #auth-left {
  padding: 5rem
}

#auth #auth-left .auth-title {
  font-size: 4rem;
  margin-bottom: 1rem
}

#auth #auth-left .auth-subtitle {
  font-size: 1.7rem;
  line-height: 2.5rem;
  color: #a8aebb
}

#auth #auth-left .auth-logo {
  margin-bottom: 7rem
}

#auth #auth-left .auth-logo img {
  height: 2rem
}

@media screen and (max-width: 1399.9px) {
  #auth #auth-left {
    padding: 3rem
  }
}

@media screen and (max-width: 767px) {
  #auth #auth-left {
    padding: 5rem
  }
}

@media screen and (max-width: 576px) {
  #auth #auth-left {
    padding: 5rem 3rem
  }
}

html[data-bs-theme=dark] #auth-right {
  background: url('https://mazer-template.pages.dev/demo/assets/compiled/png/4853433.png'), linear-gradient(90deg, #2d499d, #3f5491)
}

.signup-link {
  word-break: keep-all;
  white-space: preserve nowrap;
}

.work-offline-link {
  display: flex;
  font-size: 0.92rem;
  font-weight: normal;
  justify-content: center;
  color: rgba(128, 128, 128, 0.5);
}

.work-offline-link:hover {
  color: rgba(168, 168, 168, 0.5);
}

</style>