<script setup
        lang="ts">

import {nextTick, onMounted, ref} from "vue";
import {AES, aesKeyStore} from "@/aes.ts";
import config from "@/assets/config.json";
import {Braindump, braindumpStore} from "@/braindump.ts";
import {getDateFromUnixTimestamp, getDateString, getDateTimeString, getUnixTimestamp} from "../util.ts";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";

const aes: AES = new AES();

let search = ref('');

let refreshListDebounce: number | null = null

defineEmits(['onSelectBraindump']);

onMounted(refreshList);

function onChangedSearchTerm()
{
  if (refreshListDebounce !== null)
  {
    clearTimeout(refreshListDebounce);
  }

  refreshListDebounce = window.setTimeout(() =>
  {
    console.log('refreshing...');
    refreshList();
    refreshListDebounce = null;
  }, 512);
}

async function refreshList(): Promise<void>
{
  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}?page=1&pageSize=2147483646&sortBy=lastModificationTimestampUTC&sortingOrder=descending`,
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

    if (dump.Notes && dump.Notes.length !== 0)
    {
      dump.Notes = await aes.decryptString(dump.Notes, aesKeyStore.aesKey);
    }

    if (dump.Name)
    {
      braindumpStore.braindumps.push(dump);
    }
  }
}

async function onClickExport(clickEvent: Event, dump: Braindump): Promise<void>
{
  // todo
}

async function onClickDeleteDump(clickEvent: Event, dump: Braindump): Promise<void>
{
  clickEvent.stopImmediatePropagation();
  clickEvent.stopPropagation();
  clickEvent.preventDefault();

  if (!confirm(`Are you sure that you want to delete Braindump "${dump.Name}"?`))
  {
    return;
  }

  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}/${dump.Guid}`,
      {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  );

  if (!response.ok)
  {
    alert(`Deletion failed. Error: ${response.status} (${response.statusText})`);
    return;
  }

  await refreshList();
}

function onClickClearSearch(): void
{
  search.value = '';

  onChangedSearchTerm();
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

        <div class="input-group">

          <input type="text"
                 id="search"
                 name="search"
                 placeholder=""
                 class="form-control"
                 v-model="search"
                 @input="onChangedSearchTerm">

          <button type="button"
                  class="btn btn-danger"
                  @click="onClickClearSearch">
            Clear
          </button>

        </div>

      </div>


    </div>

  </div>

  <section style="margin-top: 1.6rem;"
           class="section">

    <div class="row"
         style="justify-content: center;">

      <div class="col-lg-8">

        <div class="card"
             :title="`Created on: ${getDateTimeString(getDateFromUnixTimestamp(dump.CreationTimestampUTC))}\n\nLast modified on: ${getDateTimeString(getDateFromUnixTimestamp(dump.LastModificationTimestampUTC))}`"
             v-for="dump in braindumpStore.braindumps">

          <div class="card-body braindump-list-entry"
               @click="$emit('onSelectBraindump', dump)">

            <span>
              {{
                dump.Name
              }}<br v-if="dump.Notes" />
              <span class="braindump-notes">
              {{
                  dump.Notes ? `\n\n${dump.Notes}` : ''
                }}
              </span>
            </span>

            <div style="flex-grow: 9"></div>

            <button type="button"
                    class="btn btn-secondary">
              <i class="bi bi-box-arrow-up-right"></i>
            </button>

            <button class="btn btn-danger"
                    @click="onClickDeleteDump($event, dump)">
              <i class="bi bi-trash"></i>
            </button>

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

.braindump-list-entry {
  gap: 8px;
  display: flex;
  align-items: center;
}

.braindump-list-entry:hover {
  cursor: pointer;
}

.braindump-list-entry:hover > span {
  color: white;
}

.braindump-notes {
  font-size: 0.88rem;
  color: rgba(130, 150, 152, 0.64);
}

.card:hover {
  filter: brightness(125%);
}

.card:active {
  filter: brightness(100%);
}

#search {
  max-width: 512px;
}

</style>