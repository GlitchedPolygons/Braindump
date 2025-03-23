<script setup
        lang="ts">

import {onMounted} from "vue";
import {AES, aesKeyStore} from "@/aes.ts";
import config from "@/assets/config.json";
import {braindumpStore} from "@/braindump.ts";
import {getDateFromUnixTimestamp} from "../util.ts";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";

const aes: AES = new AES();

defineEmits(['onSelectBraindump']);

onMounted(async () =>
{
  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}?page=1&pageSize=2147483646`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  );

  if (!response.ok)
  {
    alert('Failed to fetch braindumps from server. Please double-check your connection and try again...');
    return;
  }

  const responseBodyEnvelope = await response.json();

  if (!responseBodyEnvelope || responseBodyEnvelope.Type !== TypeNamesDTO.USER_DATA_REDUX_RESPONSE_DTO || !responseBodyEnvelope.Items || responseBodyEnvelope.Items.length === 0)
  {
    alert('Failed to fetch braindumps from server. Please double-check your connection and try again...');
    return;
  }

  braindumpStore.braindumps = [];

  for (let dump of responseBodyEnvelope.Items)
  {
    if (dump.Name === Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME)
    {
      continue;
    }

    dump.Name = await aes.decryptString(dump.Name, aesKeyStore.aesKey);

    if (dump.Name)
    {
      braindumpStore.braindumps.push(dump);
    }
  }
});

</script>

<template>

  <div v-for="dump in braindumpStore.braindumps">

    <a href="javascript:void(0);"
       @click="$emit('onSelectBraindump', dump)">
      {{ dump.Name }}
      (created on: {{ getDateFromUnixTimestamp(dump.CreationTimestampUTC).toISOString() }})
    </a>

  </div>

</template>

<style scoped>

</style>