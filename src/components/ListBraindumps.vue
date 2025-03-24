<script setup
        lang="ts">

import {onMounted, ref} from "vue";
import {AES, aesKeyStore} from "@/aes.ts";
import config from "@/assets/config.json";
import {braindumpStore} from "@/braindump.ts";
import {getDateFromUnixTimestamp, getDateString, getDateTimeString} from "../util.ts";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";

const aes: AES = new AES();

let search = ref('');

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

function onChangedSearchTerm(changeEvent: Event)
{
  const element = changeEvent.target as HTMLInputElement;

  const newSearchTerm: string = element?.value;

  console.log(newSearchTerm);
}

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


  <div class="row">

    <div class="col-lg-8">

      <div class="form-group my-2">

        <label for="search"
               class="form-label">
          Search
        </label>

        <input type="text"
               id="search"
               name="search"
               placeholder=""
               class="form-control"
               v-model="search"
               @input="onChangedSearchTerm">
      </div>

    </div>

  </div>

  <br />

  <section class="section">

    <div class="row"
         style="justify-content: center;">

      <div class="col-lg-8">

        <div class="card"
             v-for="dump in braindumpStore.braindumps">

          <div class="card-body braindump-list-entry"
               @click="$emit('onSelectBraindump', dump)">

            <span>
              {{ dump.Name }}
            , created on: {{ getDateTimeString(getDateFromUnixTimestamp(dump.CreationTimestampUTC)) }}
            </span>

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

.braindump-list-entry:hover {
  cursor: pointer;
}

.braindump-list-entry:hover > span {
  color: white;
}

.card:hover {
  filter: brightness(125%);
}

.card:active {
  filter: brightness(100%);
}

</style>