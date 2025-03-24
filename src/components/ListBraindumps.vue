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

<!--
  <div class="page-title">
    <div class="row">
      <div class="col-lg-8 order-md-1 order-last">
        <h3>
          Braindumps
        </h3>

        <p class="text-subtitle text-muted">
          Here's a list of all of your braindumps...
        </p>
      </div>
    </div>
  </div>
-->
  
  <section class="section">

    <div class="row"
         style="justify-content: center;">

      <div class="col-lg-8">

        <div class="card">

          <!--
                    <div class="card-header">

                      <h5 class="card-title">
                        Braindumps
                      </h5>

                    </div>
          -->
          <div class="card-body">

            <div v-for="dump in braindumpStore.braindumps">

              <a href="javascript:void(0);"
                 @click="$emit('onSelectBraindump', dump)">
                {{ dump.Name }}
                (created on: {{ getDateFromUnixTimestamp(dump.CreationTimestampUTC).toISOString() }})
              </a>

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

</style>