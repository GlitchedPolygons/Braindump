<script setup
        lang="ts">

import {nextTick, onMounted, onUnmounted, ref} from "vue";

import {AES, aesKeyStore} from "@/aes.ts";

import config from "@/assets/config.json";

import {Braindump, braindumpStore} from "@/braindump.ts";

import {
  deepClone,
  exportBraindump,
  getDateFromUnixTimestamp,
  getDateString,
  getDateTimeString,
  getUnixTimestamp,
  refreshUserAccount,
  splitIntoChunks
} from "../util.ts";

import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";

const aes: AES = new AES();

const decryptionWorkerURL = new URL('@/cryptoworker.ts', import.meta.url);

let search = ref('');

let lastOnWindowFocus: number = 0;

let refreshing = ref(false);

let refreshListDebounce: number | null = null;

let decryptionWorkerCount: number = 2;

let decryptedChunkCount: number = 0;

let decryptedChunks: Array<Array<Braindump>> = [];

defineEmits(['onSelectBraindump']);

onMounted(() =>
{
  lastOnWindowFocus = getUnixTimestamp() - 1;

  refreshList();

  window.addEventListener('focus', onWindowFocus);
});

onUnmounted(() => window.removeEventListener('focus', onWindowFocus));

function onWindowFocus(): void
{
  const utcNow: number = getUnixTimestamp();

  if (utcNow - lastOnWindowFocus > 64)
  {
    onChangedSearchTerm();
  }

  lastOnWindowFocus = utcNow;
}

function onChangedSearchTerm()
{
  if (refreshListDebounce !== null)
  {
    window.clearTimeout(refreshListDebounce);
  }

  refreshListDebounce = window.setTimeout(() =>
  {
    refreshList();
    refreshListDebounce = null;
  }, 512);
}

async function refreshList(): Promise<void>
{
  if (refreshing.value === true)
  {
    return;
  }

  refreshing.value = true;

  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}?page=1&pageSize=2147483646&sortingColumnIndex=2&sortingOrder=descending`,
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
    refreshing.value = false;
    return;
  }

  const responseBodyEnvelope = await response.json();

  if (!responseBodyEnvelope || responseBodyEnvelope.Type !== TypeNamesDTO.USER_DATA_REDUX_RESPONSE_DTO)
  {
    alert('Failed to fetch braindumps from server. Please double-check your connection and try again...');
    refreshing.value = false;
    return;
  }

  braindumpStore.braindumps = [];
  braindumpStore.workingOffline = false;

  if (!responseBodyEnvelope.Items || responseBodyEnvelope.Items.length === 0)
  {
    refreshing.value = false;
    return;
  }

  if (window.Worker && config.EnableWebWorkerDecryption)
  {
    decryptedChunks = [];
    decryptedChunkCount = 0;
    decryptionWorkerCount = Math.min(navigator.hardwareConcurrency, responseBodyEnvelope.Items.length);

    console.log(`Decrypting braindumps using ${decryptionWorkerCount} parallel web workers...`);

    const chunks: Array<Array<Braindump>> = splitIntoChunks([...responseBodyEnvelope.Items], decryptionWorkerCount);

    for (let i = 0; i < chunks.length; ++i)
    {
      const decryptionWorker = new window.Worker
      (
          decryptionWorkerURL,
          {
            type: 'module'
          }
      );

      decryptionWorker.onmessage = onDecryptionFinished;

      decryptionWorker.postMessage
      ({
        chunkIndex: i,
        search: search.value,
        aesKey: deepClone(aesKeyStore.aesKey),
        dumps: deepClone(chunks[i])
      });
    }
  }
  else
  {
    let promises: Promise<Braindump>[] = [];

    for (let dump of responseBodyEnvelope.Items)
    {
      if (dump.Name === Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME)
      {
        continue;
      }

      promises.push(new Promise<Braindump>(async resolve =>
      {
        dump.Name = await aes.decryptString(dump.Name, aesKeyStore.aesKey);

        if (!dump.Name)
        {
          dump.Name = Constants.DEFAULT_BRAINDUMP_NAME;
        }

        if (dump.Notes && dump.Notes.length !== 0)
        {
          dump.Notes = await aes.decryptString(dump.Notes, aesKeyStore.aesKey);
        }

        const searchEnabled: boolean = !!search.value && search.value.length !== 0;

        if
        (
            dump.Name
            &&
            (
                !searchEnabled
                ||
                (
                    dump.Name.toLowerCase().replace(' ', '').includes(search.value.toLowerCase())
                    ||
                    dump.Notes.toLowerCase().replace(' ', '').includes(search.value.toLowerCase())
                )
            )
        )
        {
          return resolve(dump as Braindump);
        }

        return resolve(deepClone(Constants.DEFAULT_BRAINDUMP) as Braindump);
      }));
    }

    for (const dump of await Promise.all(promises))
    {
      if (!dump.Guid)
      {
        continue;
      }

      braindumpStore.braindumps.push(dump);
    }

    refreshing.value = false;
  }
}

function onDecryptionFinished(e: MessageEvent<any>): void
{
  ++decryptedChunkCount;

  decryptedChunks[e.data.chunkIndex] = e.data.dumps;

  if (decryptedChunkCount === decryptionWorkerCount)
  {
    for (let i = 0; i < decryptionWorkerCount; ++i)
    {
      for (let ii = 0; ii < decryptedChunks[i].length; ii++)
      {
        braindumpStore.braindumps.push(decryptedChunks[i][ii]);
      }
    }

    refreshing.value = false;
  }
}

function onClickExport(clickEvent: Event, dump: Braindump): void
{
  clickEvent.stopImmediatePropagation();
  clickEvent.stopPropagation();
  clickEvent.preventDefault();

  exportBraindump(dump.Guid, aes);
}

async function onClickDeleteDump(clickEvent: Event, dump: Braindump): Promise<void>
{
  clickEvent.stopImmediatePropagation();
  clickEvent.stopPropagation();
  clickEvent.preventDefault();

  const keyboardEvent = clickEvent as KeyboardEvent;

  if (!keyboardEvent.ctrlKey && !confirm(`Are you sure that you want to delete Braindump "${dump.Name}"?`))
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
  if (search.value === '')
  {
    return;
  }

  search.value = '';

  onChangedSearchTerm();
}

</script>

<template>

  <div class="row">

    <div class="col-lg-8">

      <div class="form-group my-2">

        <label for="search"
               class="form-label">

          Search <i v-if="refreshing"
                    class="bi bi-hourglass pending-search-indicator"></i>
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
             v-if="!refreshing"
             v-for="dump in braindumpStore.braindumps"
             :title="`Created on: ${getDateTimeString(getDateFromUnixTimestamp(dump.CreationTimestampUTC))}\n\nLast modified on: ${getDateTimeString(getDateFromUnixTimestamp(dump.LastModificationTimestampUTC))}`">

          <div class="card-body braindump-list-entry"
               @click="$emit('onSelectBraindump', dump)">

            <span class="unselectable">
              {{
                dump.Name
              }}<br v-if="dump.Notes" />
              <span class="braindump-notes unselectable">
              {{
                  dump.Notes ? `\n\n${dump.Notes}` : ''
                }}
              </span>
            </span>

            <div style="flex-grow: 9;"></div>

            <button type="button"
                    title="Click here to export this Braindump to a file"
                    @click="onClickExport($event, dump)"
                    class="btn btn-secondary">
              <i class="bi bi-box-arrow-up-right"></i>
            </button>

            <button type="button"
                    title="Delete this Braindump (hold down Ctrl key to skip confirmation dialog)"
                    class="btn btn-danger"
                    @click="onClickDeleteDump($event, dump)">
              <i class="bi bi-trash"></i>
            </button>

          </div>

        </div>

        <div v-if="!braindumpStore.braindumps || braindumpStore.braindumps.length === 0">
          <h2>
            {{ refreshing ? 'Loading...' : 'Empty. Start braindumpin\' now!' }}
          </h2>
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

html[data-bs-theme="light"] {
  .card:hover {
    filter: brightness(94%);
  }

  .braindump-list-entry:hover > span {
    color: var(--bs-card-color);
  }
}

.card:active {
  filter: brightness(100%);
}

#search {
  max-width: 512px;
}

</style>