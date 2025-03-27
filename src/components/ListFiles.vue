<script setup
        lang="ts">

import {nextTick, onMounted, ref} from "vue";
import config from "@/assets/config.json";
import {type BraindumpFile} from "@/braindump.ts";
import StorageQuotaIndicator from "@/components/StorageQuotaIndicator.vue";
import {EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {
  bytesToFileSizeString,
  getDateFromUnixTimestamp,
  getDateTimeString,
  pageCountFromTotal,
  refreshUserAccount
} from "../util.ts";

onMounted(() =>
{
  // todo: deserialize page size, sort order and sort col index here (from localstorage)

  refreshList();
});

let refreshing = ref(false);

let files = ref([]);

let page = ref(1);
let pageSize = ref(10);
let pageCount = ref(10);
let sortingOrder = ref(1);
let sortingColumnIndex = ref(3);

async function refreshList(): Promise<void>
{
  if (refreshing.value === true)
  {
    return;
  }

  refreshing.value = true;

  // todo: serialize page size, sort order and sort col index here (into localstorage)

  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.FILE_ENTRIES}?page=${page.value}&pageSize=${pageSize.value}&sortingColumnIndex=${sortingColumnIndex.value}&sortingOrder=${sortingOrder.value}`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  );

  if (!response.ok)
  {
    alert('Failed to fetch braindump files from server. Please double-check your connection and try again...');
    refreshing.value = false;
    return;
  }

  const refreshUserQuotaTask = refreshUserAccount();

  const responseBodyEnvelope = await response.json();

  if (!responseBodyEnvelope || responseBodyEnvelope.Type !== TypeNamesDTO.USER_FILE_RESPONSE_DTO || !responseBodyEnvelope.Items)
  {
    alert('Failed to fetch braindump files from server. Please double-check your connection and try again...');
    refreshing.value = false;
    return;
  }

  files.value = responseBodyEnvelope.Items;

  pageCount.value = pageCountFromTotal(responseBodyEnvelope.Count, pageSize.value);

  refreshing.value = false;

  await refreshUserQuotaTask;

  if (pageCount.value !== 0 && page.value > pageCount.value)
  {
    page.value = pageCount.value;
    refreshList();
  }
}

async function onClickDeleteFile(clickEvent: Event, file: BraindumpFile): Promise<void>
{
  clickEvent.stopImmediatePropagation();
  clickEvent.stopPropagation();
  clickEvent.preventDefault();

  if (!clickEvent.ctrlKey && !confirm(`Are you sure that you want to delete the file "${file.Guid}"?\n\nPlease keep in mind that any links to it inside a Braindump will break (e.g. images not showing up).`))
  {
    return;
  }

  const response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.FILE_ENTRIES}/${file.Guid}`,
      {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  );

  if (response.status !== 204)
  {
    alert(`Deletion failed. Error: ${response.status} (${response.statusText})`);
    return;
  }

  nextTick().then(refreshList).then(refreshUserAccount);
}

function getFileUri(file: BraindumpFile): string
{
  return `${config.BackendBaseURL}${EndpointURLs.FILE_ENTRIES}/${file.Guid}`;
}

function onClickPrevPage(): void
{
  if (page.value === 1)
  {
    return;
  }

  page.value--;
  refreshList();
}

function onClickNextPage(): void
{
  if (page.value === pageCount.value)
  {
    return;
  }

  page.value++;
  refreshList();
}

</script>

<template>

  <div class="page-title">

    <div class="row">

      <div class="col-lg-8 order-md-1 order-last">

        <h3>
          Files
        </h3>

        <p class="text-subtitle text-muted">
          These are all the files you've uploaded to your Braindump account. <br />
          You can free some space and regain quota by deleting some of them. <br />
          Just remember that doing so might break links in existing dumps that still make use of the underlying content
          (e.g. images might not show up).
        </p>

        <br />

        <StorageQuotaIndicator />

      </div>

    </div>

  </div>

  <div class="row sorting-options"
       v-if="files && files.length !== 0">

    <div class="col-md-3">

      <span class="dropdown-label">
        Sort by
      </span>

      <select class="form-select"
              v-model="sortingColumnIndex"
              @change="refreshList"
              id="sorting-column-index-dropdown">

        <option value="3">
          File size
        </option>

        <option value="0">
          File name
        </option>

        <option value="2">
          Upload timestamp
        </option>

      </select>

    </div>

    <div class="col-md-3">

      <span class="dropdown-label">
        Sort order
      </span>

      <select class="form-select"
              v-model="sortingOrder"
              @change="refreshList"
              id="sorting-order-dropdown">

        <option value="1">
          Descending
        </option>

        <option value="0">
          Ascending
        </option>

      </select>

    </div>

    <div class="col-md-2">

      <span class="dropdown-label">
        Page size
      </span>

      <select class="form-select"
              v-model="pageSize"
              @change="refreshList"
              id="sorting-column-index-dropdown">

        <option value="2">
          2
        </option>

        <option value="10">
          10
        </option>

        <option value="25">
          25
        </option>

        <option value="50">
          50
        </option>

      </select>

    </div>

  </div>

  <br />

  <div class="row">

    <div class="col-lg-4"
         v-for="file in files">

      <div class="card">

        <div class="card-content">

          <div class="card-body">

            <h4 class="card-title">{{ file.Guid }}</h4>

            <p class="card-text">

              File size: {{ bytesToFileSizeString(file.FileSizeBytes) }} <br />

              File name: {{ file.FileName }}<br />

              Uploaded on: {{ getDateTimeString(getDateFromUnixTimestamp(file.CreationTimestampUTC)) }}<br />

              <span v-if="file.LastModificationTimestampUTC !== file.CreationTimestampUTC">
                Modified on: {{ getDateTimeString(getDateFromUnixTimestamp(file.LastModificationTimestampUTC)) }}<br />
              </span>
            </p>

            <div class="img-preview">

              <img :src="getFileUri(file)"
                   :title="`SHA-256: ${file.SHA256}`"
                   class="img-fluid w-100"
                   style="max-width: 314px"
                   loading="lazy"
                   alt="">

            </div>

          </div>

        </div>

        <div class="card-footer d-flex justify-content-center"
             style="gap: 16px; flex-wrap: wrap;">

          <a :href="getFileUri(file)"
             target="_blank"
             class="btn btn-primary bdmp-button">
            <i class="bi bi-download"></i>
            Download
          </a>

          <button type="button"
                  title="Hold down Ctrl to directly delete and skip confirmation dialog"
                  @click="onClickDeleteFile($event, file);"
                  class="btn btn-danger bdmp-button">
            <i class="bi bi-trash"></i>
            Delete
          </button>

        </div>

      </div>

    </div>

  </div>

  <div class="btn-group"
       v-if="files && files.length !== 0"
       role="group">

    <button type="button"
            :disabled="page === 1"
            class="btn btn-secondary"
            @click="onClickPrevPage"
            title="Load the previous page of files"> &nbsp;«&nbsp;
    </button>

    <button class="btn btn-secondary btn-page-indicator-void">
      {{ page }} / {{ pageCount }}
    </button>

    <button type="button"
            class="btn btn-secondary"
            :disabled="page === pageCount"
            @click="onClickNextPage"
            title="Load the next page of files"> &nbsp;»&nbsp;
    </button>
  </div>


</template>

<style scoped>

@media (max-width: 420px) {
  .bdmp-button {
    width: 100%;
  }
}

html[data-bs-theme="dark"] .card-footer {
  border-top: 1px solid rgba(72, 82, 94, 0.225);
}

.img-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropdown-label {
  margin-bottom: 6px;
}

@media (max-width: 768px) {
  .sorting-options {
    gap: 8px;
    margin-bottom: 8px;
  }
}

</style>