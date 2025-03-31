<script setup
        lang="ts">

import config from "@/assets/config.json"
import Login from "@/components/Login.vue";
import Braindump from "@/components/Braindump.vue";

import {onMounted, ref} from "vue";
import {braindumpStore} from "@/braindump.ts";
import {getUnixTimestamp, logout} from "@/util.ts";
import {TypeNamesDTO, LocalStorageKeys, EndpointURLs, Constants} from "@/constants.ts";

let refreshAuthTokenScheduledTask: number | null = null;
let lastAuthTokenRefreshUTC: number = 0;
let lastOnWindowFocus: number = 0;
let showLoginPage = ref(true);

onMounted(() =>
{
  lastOnWindowFocus = getUnixTimestamp() - 1;

  lastAuthTokenRefreshUTC = Number.parseInt(localStorage.getItem(LocalStorageKeys.LAST_AUTH_TOKEN_REFRESH_UTC) ?? '0');

  if (isNaN(lastAuthTokenRefreshUTC))
  {
    lastAuthTokenRefreshUTC = 0;
  }

  const storedDefibrillatorToken: string = localStorage.getItem(LocalStorageKeys.DEFIBRILLATOR_TOKEN) ?? '';

  if (storedDefibrillatorToken && storedDefibrillatorToken.length > 0)
  {
    braindumpStore.defibrillatorToken = storedDefibrillatorToken;
  }

  showLoginPage.value = isLoginRequired();

  window.onfocus = onWindowFocus;
  document.onvisibilitychange = onWindowFocus;

  refreshAuthToken();

  setupRefreshAuthTokenScheduledTask();

  loadExternalScript('https://mazer-template.pages.dev/demo/assets/extensions/perfect-scrollbar/perfect-scrollbar.min.js', 'vktDQfr/Ikhrtti/FA+u5LohNzPpFSlhp9Xj+rER/Vs=');
  loadExternalScript('https://mazer-template.pages.dev/demo/assets/compiled/js/app.js', 'l8rWVyz/sArb+OzMOB2mU9LHrvbrOPCJEsnIyYbC8Gk=');
  loadExternalScript('https://mazer-template.pages.dev/demo/assets/extensions/apexcharts/apexcharts.min.js', '+cagC7gYBHDzF6s5VmZnJFj3CZZYAb3ofFP6Qdv7k7E=');
});

function onWindowFocus(): void
{
  if (document.hidden)
  {
    return;
  }

  refreshAuthToken();

  const utcNow: number = getUnixTimestamp();

  if (utcNow - lastOnWindowFocus > 256)
  {
    setupRefreshAuthTokenScheduledTask();
  }

  lastOnWindowFocus = utcNow;
}

function setupRefreshAuthTokenScheduledTask(): void
{
  if (refreshAuthTokenScheduledTask !== null)
  {
    window.clearInterval(refreshAuthTokenScheduledTask);
  }

  refreshAuthTokenScheduledTask = window.setInterval
  (
      () =>
      {
        refreshAuthToken();
      },
      1024 * 8
  );
}

function loadExternalScript(url: string, sha256sumBase64: string = '')
{
  const scriptElement: HTMLScriptElement = document.createElement("script");

  scriptElement.setAttribute
  (
      "src",
      url
  );

  if (sha256sumBase64)
  {
    scriptElement.setAttribute
    (
        "crossorigin",
        ''
    );

    scriptElement.setAttribute
    (
        "integrity",
        `sha256-${sha256sumBase64}`
    );
  }

  document.head.appendChild(scriptElement);
}

function isLoginRequired(): boolean
{
  if (!localStorage.getItem(LocalStorageKeys.AUTH_TOKEN))
  {
    return true;
  }

  if (!localStorage.getItem(LocalStorageKeys.PASSWORD_HASH))
  {
    return true;
  }

  if (getUnixTimestamp() - lastAuthTokenRefreshUTC > Constants.AUTH_TOKEN_DEFIBRILLATION_INTERVAL_SECONDS)
  {
    return true;
  }

  return false;
}

function refreshAuthToken()
{
  const loginRequired: boolean = isLoginRequired();

  if (!loginRequired || braindumpStore.workingOffline)
  {
    return;
  }

  const defibrillatorToken: string = braindumpStore.defibrillatorToken;
  const expiredToken: string = localStorage.getItem(LocalStorageKeys.AUTH_TOKEN) ?? '';

  if (!expiredToken || !defibrillatorToken)
  {
    showLoginPage.value = true;
    return;
  }

  const utcNow: number = getUnixTimestamp();

  if (utcNow - lastAuthTokenRefreshUTC < Constants.AUTH_TOKEN_DEFIBRILLATION_INTERVAL_SECONDS)
  {
    return;
  }

  lastAuthTokenRefreshUTC = utcNow;

  const requestContext = {
    method: 'POST',
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      ExpiredToken: expiredToken,
      DefibrillatorToken: defibrillatorToken,
    }),
  };

  fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.REVIVE}`,
      requestContext
  ).then
  (
      response =>
      {
        if (!response.ok)
        {
          logout();
        }

        response.json().then((responseBodyEnvelope) =>
        {
          if (responseBodyEnvelope.Type === TypeNamesDTO.LOGIN_RESPONSE_DTO && responseBodyEnvelope.Items && responseBodyEnvelope.Items.length !== 0)
          {
            const loginResponseDto = responseBodyEnvelope.Items[0];

            if (localStorage.getItem(LocalStorageKeys.SAVE_DEFIBRILLATOR_TOKEN) === 'true')
            {
              localStorage.setItem(LocalStorageKeys.DEFIBRILLATOR_TOKEN, loginResponseDto.DefibrillatorToken);
            }

            localStorage.setItem(LocalStorageKeys.AUTH_TOKEN, loginResponseDto.Token);

            showLoginPage.value = false;

            braindumpStore.workingOffline = false;
            braindumpStore.defibrillatorToken = loginResponseDto.DefibrillatorToken;
          }
        });
      }
  );
}

</script>

<template>

  <Login @onLoginSuccessful="showLoginPage = false;"
         v-if="showLoginPage && !braindumpStore.workingOffline" />

  <Braindump v-else />

</template>

<style scoped>

</style>
