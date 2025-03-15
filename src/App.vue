<script setup
        lang="ts">

import config from "@/assets/config.json"
import Login from "@/components/Login.vue";
import Braindump from "@/components/Braindump.vue";

import {onMounted} from "vue";
import {TypeNamesDTO, LocalStorageKeys, EndpointURLs} from "@/constants.ts";
import {getUnixTimestamp} from "@/util.ts";

let lastAuthTokenRefreshUTC: number = 0;

onMounted(() =>
{
  lastAuthTokenRefreshUTC = Number.parseInt(localStorage.getItem(LocalStorageKeys.LAST_AUTH_TOKEN_REFRESH_UTC) ?? '0');

  if (isNaN(lastAuthTokenRefreshUTC))
  {
    lastAuthTokenRefreshUTC = 0;
  }

  setInterval
  (
      () =>
      {
        refreshAuthToken();
      },
      1024 * 8
  );

  refreshAuthToken();
});

document.onvisibilitychange = () =>
{
  if (document.hidden)
  {
    return;
  }

  refreshAuthToken();
};

function isLoginRequired(): boolean
{
  return !localStorage.getItem(LocalStorageKeys.AUTH_TOKEN) || !localStorage.getItem(LocalStorageKeys.PASSWORD_HASH);
}

function refreshAuthToken()
{
  if (isLoginRequired())
  {
    return;
  }

  const expiredToken: string = localStorage.getItem(LocalStorageKeys.AUTH_TOKEN) ?? '';
  const defibrillatorToken: string = localStorage.getItem(LocalStorageKeys.DEFIBRILLATOR_TOKEN) ?? '';

  if (!defibrillatorToken)
  {
    return;
  }

  const utcNow: number = getUnixTimestamp();

  if (utcNow - lastAuthTokenRefreshUTC < 512)
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
          }
        });
      }
  );
}

</script>

<template>

  <Login v-if="isLoginRequired()" />

  <Braindump v-else />

</template>

<style scoped>

</style>
