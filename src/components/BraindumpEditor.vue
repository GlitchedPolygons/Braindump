<script setup
        lang="ts">

import 'md-editor-v3/lib/style.css';
import {onMounted, reactive, ref, toRaw, nextTick} from "vue";
import {Braindump, braindumpStore} from "@/braindump.ts";
import {MdEditor, MdPreview, config} from 'md-editor-v3';
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";

import {
  arrayBufferToHexEncodedString,
  deepClone,
  exportBraindump,
  getDateFromUnixTimestamp,
  getDateTimeString,
  getUnixTimestamp,
  logout,
  toggleCheckboxInMarkdown
} from "@/util.ts";

import bdConfig from "@/assets/config.json";
import {AES, aesKeyStore} from "@/aes.ts";

type ImgUploadCallback = (url: string) => void;

let editing = ref(true);

let edited = ref(deepClone(Constants.DEFAULT_BRAINDUMP) as Braindump);

let saveDebounce: number | null = null;
let nameEncryptionTask: Promise<string> | null = null;
let notesEncryptionTask: Promise<string> | null = null;
let markdownEncryptionTask: Promise<string> | null = null;

let busy = ref(false);

let hideHelpText = ref(false);

const aes: AES = new AES();

const state = reactive({
  text: '',
  theme: 'dark',
});

defineExpose({onCreateNewBraindump});

const emit = defineEmits(['onCloseEditor']);

config({
  editorConfig: {
    renderDelay: 64
  },
  markdownItPlugins(plugins, {editorId})
  {
    return plugins.map((item) =>
    {
      if (item.type === 'taskList')
      {
        return {
          ...item,
          options: {
            ...item.options,
            enabled: true,
          },
        };
      }
      return item;
    });
  },
});

onMounted(() =>
{
  hideHelpText.value = localStorage.getItem(LocalStorageKeys.HIDE_EDITOR_HELP_TEXT) === 'true';

  if (braindumpStore.editedBraindump)
  {
    editing.value = false;

    edited.value = deepClone(toRaw(braindumpStore.editedBraindump));
  }

  hookIntoCheckboxInputEvents();

  window.onChangedTheme = (theme: string) =>
  {
    state.theme = theme;
  };

  window.onChangedTheme(localStorage.getItem(LocalStorageKeys.THEME));
});

function onClickHideHelpText(): void
{
  hideHelpText.value = true;
  localStorage.setItem(LocalStorageKeys.HIDE_EDITOR_HELP_TEXT, 'true');
}

function onClickShowHelpText(): void
{
  hideHelpText.value = false;
  localStorage.setItem(LocalStorageKeys.HIDE_EDITOR_HELP_TEXT, 'false');
}

function hookIntoCheckboxInputEvents(): void
{
  if (editing.value === true)
  {
    return;
  }

  nextTick().then(() =>
  {
    for (const element of document.getElementsByClassName('task-list-item-checkbox'))
    {
      element.removeEventListener('click', onClickCheckbox);
      element.addEventListener('click', onClickCheckbox);
    }
  });
}

function onClickCheckbox(clickEvent: Event): void
{
  if (editing.value === true)
  {
    return;
  }

  toggleCheckboxInMarkdown(clickEvent, edited);

  onChangedMarkdown(edited.value.Data, true);

  nextTick().then(saveBraindump);
}

function onChangedName(changeEvent: Event)
{
  const element = changeEvent.target as HTMLInputElement;

  nameEncryptionTask = aes.encryptString(element?.value ?? '(Untitled)', aesKeyStore.aesKey);

  debounceSave();
}

function onChangedNotes(changeEvent: Event)
{
  const element = changeEvent.target as HTMLInputElement;

  notesEncryptionTask =
      !element || !element.value
          ? new Promise<string>(() => '')
          : aes.encryptString(element?.value ?? '', aesKeyStore.aesKey);

  debounceSave();
}

function onChangedMarkdown(markdown: string, dontSave: boolean = false): void
{
  markdownEncryptionTask = aes.encryptString(markdown, aesKeyStore.aesKey);

  if (!dontSave)
  {
    debounceSave();
  }
}

async function onUploadImg(files: File[], callback: ImgUploadCallback): Promise<void>
{
  const r = await Promise.all
  (
      files.map((file) =>
      {
        return new Promise(async (rev, rej) =>
        {
          const form = new FormData();

          const sha256 = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer())

          form.append('sha256', arrayBufferToHexEncodedString(sha256));
          form.append('filename', `${getUnixTimestamp()}-${file.name}`);
          form.append('filesizebytes', file.size.toString());
          form.append('private', 'false');
          form.append('file', file);

          const requestContext = {
            method: 'POST',
            body: form,
            headers: {
              'Authorization': `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
            },
          };

          try
          {
            const response = await fetch
            (
                `${bdConfig.BackendBaseURL}${EndpointURLs.FILE_ENTRIES}`,
                requestContext
            );

            if (!response.ok)
            {
              switch (response.status)
              {
                case 400:
                {
                  const errorMsg: string = `Upload failed!\n\nErrors:\n${JSON.stringify((await response.json()).errors, null, 2)}`;
                  alert(errorMsg);
                  rej(errorMsg);
                  return;
                }
                case 401:
                case 403:
                {
                  logout();
                  return;
                }
                case 413:
                {
                  const errorMsg: string = 'Insufficient user quota! Please upload a smaller file or free some space on the remote file storage.';
                  alert(errorMsg);
                  rej(errorMsg);
                  return;
                }
                default:
                {
                  const errorMsg: string = 'Upload failed! Please upload the file on a different remote file storage and use a link instead. If this error persists, please inform the domain owner about this.';
                  alert(errorMsg);
                  rej(errorMsg);
                  return;
                }
              }
            }

            const responseBodyEnvelope = await response.json();

            if (responseBodyEnvelope.Type !== TypeNamesDTO.USER_FILE_UPLOAD_RESPONSE_DTO || !responseBodyEnvelope.Items || responseBodyEnvelope.Items.length !== 1)
            {
              rej(response);
            }

            rev(responseBodyEnvelope.Items[0]);
          }
          catch (e)
          {
            rej(e);
          }
        });
      })
  );

  callback(r.map((item) => `${bdConfig.BackendBaseURL}${EndpointURLs.FILE_ENTRIES}/${item?.Guid}`));
}

function onCreateNewBraindump(): void
{
  braindumpStore.editedBraindump = deepClone(Constants.DEFAULT_BRAINDUMP);

  edited.value = braindumpStore.editedBraindump;

  onClickEdit();
}

function onClickEdit(): void
{
  editing.value = true;
}

function onClickDone(): void
{
  editing.value = false;

  if (!edited.value.Guid)
  {
    emit('onCloseEditor');
  }
}

async function onClickExport(): Promise<void>
{
  await exportBraindump(edited.value.Guid, aes);
}

async function onClickDelete(clickEvent: Event): Promise<void>
{
  if (!edited.value)
  {
    return;
  }

  if (!clickEvent.ctrlKey && !confirm(`Are you sure that you want to delete Braindump "${edited.value.Name}"?`))
  {
    return;
  }

  const response = await fetch
  (
      `${bdConfig.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}/${edited.value.Guid}`,
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

  emit('onCloseEditor');
}

function debounceSave(): void
{
  if (saveDebounce !== null)
  {
    window.clearTimeout(saveDebounce);
  }

  saveDebounce = window.setTimeout(() =>
  {
    saveBraindump();
    saveDebounce = null;
  }, 1024);
}

async function saveBraindump(): Promise<void>
{
  markdownEncryptionTask ??= aes.encryptString(edited?.value?.Data ?? '', aesKeyStore.aesKey);

  notesEncryptionTask ??= aes.encryptString(edited?.value?.Notes ?? '', aesKeyStore.aesKey);

  let name: string = edited?.value?.Name ?? '';

  if (name.length < 1)
  {
    name = '(Untitled)';
    nameEncryptionTask = null;
  }

  nameEncryptionTask ??= aes.encryptString(name, aesKeyStore.aesKey);

  if (busy.value === true)
  {
    return;
  }

  busy.value = true;

  /*
  const nameAvailabilityCheckRequestContext = {
    method: 'POST',
    body: JSON.stringify({
      Name: edited.value.Name,
    }),
    headers: {
      'Authorization': `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
    },
  };

  const nameAvailabilityCheckResponse = await fetch
  (
      `${bdConfig.BackendBaseURL}${EndpointURLs.CHECK_NAME_AVAILABILITY}`,
      nameAvailabilityCheckRequestContext
  );

  if (!nameAvailabilityCheckResponse.ok)
  {
    alert(`The name "${edited.value.Name}" is not available. Please enter a unique name and try again!`);
    busy.value = false;
    return;
  }
  */

  const isNew: boolean = !edited.value.Guid;

  const encryptedName: string = nameEncryptionTask ? await nameEncryptionTask : '';
  const encryptedNotes: string = notesEncryptionTask ? await notesEncryptionTask : '';
  const encryptedMarkdown: string = markdownEncryptionTask ? await markdownEncryptionTask : '';

  const url: string =
      isNew
          ? `${bdConfig.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}`
          : `${bdConfig.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}/${edited.value.Guid}`;

  const method: string =
      isNew
          ? 'POST'
          : 'PUT';

  const saveRequestContext = {
    method: method,
    body: JSON.stringify({
      Private: true,
      Name: encryptedName,
      Notes: encryptedNotes,
      Data: encryptedMarkdown
    }),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
    },
  };

  const response = await fetch
  (
      url,
      saveRequestContext
  );

  busy.value = false;

  if (!response.ok)
  {
    switch (response.status)
    {
      case 400:
      {
        const errorMsg: string = `Upload failed!\n\nErrors:\n${JSON.stringify((await response.json()).errors, null, 2)}`;
        alert(errorMsg);
        return;
      }
      case 401:
      case 403:
      {
        logout();
        return;
      }
      case 413:
      {
        const errorMsg: string = 'Insufficient user quota! Please free some space before continuing.';
        alert(errorMsg);
        return;
      }
      default:
      {
        const errorMsg: string = `Error ${response.status} (${response.statusText})`;
        alert(errorMsg);
        return;
      }
    }
  }

  const responseBodyEnvelope = await response.json();

  if (responseBodyEnvelope.Type !== TypeNamesDTO.USER_DATA_RESPONSE_DTO || responseBodyEnvelope.Items.length !== 1)
  {
    alert('Save operation failed. Please upload the file and try again.');
    return;
  }

  const createdBraindumpResponseDto = responseBodyEnvelope.Items[0];

  edited.value.Guid = createdBraindumpResponseDto.Guid;
  edited.value.Private = createdBraindumpResponseDto.Private;
  edited.value.CreationTimestampUTC = createdBraindumpResponseDto.CreationTimestampUTC;
  edited.value.LastModificationTimestampUTC = createdBraindumpResponseDto.LastModificationTimestampUTC;

  edited.value.Data = await aes.decryptString(createdBraindumpResponseDto.Data, aesKeyStore.aesKey);

  edited.value.Name =
      createdBraindumpResponseDto.Name
          ? await aes.decryptString(createdBraindumpResponseDto.Name, aesKeyStore.aesKey)
          : '';

  edited.value.Notes =
      createdBraindumpResponseDto.Notes
          ? await aes.decryptString(createdBraindumpResponseDto.Notes, aesKeyStore.aesKey)
          : '';

  braindumpStore.editedBraindump = deepClone(toRaw(edited.value));

  hookIntoCheckboxInputEvents();
}

</script>

<template>

  <div v-if="editing">

    <div class="page-title">

      <div class="row">

        <div class="col-12 order-md-1 order-last">

          <h3>
            Editor <sup><span class="badge bg-primary show-help-text-badge"
                              title="Show help text"
                              v-if="hideHelpText"
                              @click="onClickShowHelpText">?</span></sup>
          </h3>

          <p class="text-subtitle text-muted"
             v-if="!hideHelpText">
            Create or modify a braindump using the great <a href="https://www.markdownguide.org/getting-started/"
                                                            target="_blank">Markdown</a> syntax with this editor.
            Changes are saved automatically.
            All content is client-side encrypted <strong>before</strong> being sent to the server.
            <span class="badge bg-primary hide-help-text-badge"
                  title="Hide help text"
                  @click="onClickHideHelpText">Hide</span>
          </p>

        </div>

      </div>

    </div>

    <section class="section mt-2">

      <div class="row"
           style="justify-content: center;">

        <div class="col-12">

          <div class="card">

            <div class="card-header">

              <h5 class="card-title">
                {{ edited.Guid ? 'Edit' : 'Create' }} Braindump
              </h5>

            </div>

            <div class="card-body">

              <div class="form-group my-2">

                <label for="name"
                       class="form-label">
                  Name
                </label>

                <input type="text"
                       id="name"
                       name="name"
                       maxlength="250"
                       class="form-control"
                       v-model="edited.Name"
                       @input="onChangedName"
                       v-on:keyup.enter="saveBraindump();"
                       placeholder="Give your braindump a descriptive title">
              </div>

              <div class="form-group my-2"
                   style="margin-bottom: 0.85rem !important;">

                <label for="password"
                       class="form-label">
                  Notes
                </label>

                <textarea type="text"
                          name="notes"
                          id="notes"
                          rows="5"
                          maxlength="500"
                          class="form-control"
                          v-model="edited.Notes"
                          @input="onChangedNotes"
                          placeholder="Enter an optional description of what this braindump is about."></textarea>

                <small class="unselectable"
                       :style="`margin-left: 2px; ${edited.Notes.length < 420 ? '' : edited.Notes.length < 480 ? 'color: orange' : 'color: red'}`">
                  {{ edited.Notes.length }} / 500
                </small>

              </div>

              <MdEditor v-model="edited.Data"
                        :id="'md-editor'"
                        :preview="false"
                        :maxLength="1048576"
                        :language="'en-US'"
                        :toolbars="Constants.TOOLBAR"
                        :theme="state.theme"
                        :noUploadImg="braindumpStore.workingOffline"
                        @onUploadImg="onUploadImg"
                        @onChange="onChangedMarkdown" />

              <div class="bottom-spacer"></div>

              <div class="form-group my-2 d-flex justify-content-end action-buttons">

                <button type="button"
                        @click="onClickDone"
                        class="btn btn-primary bdmp-button save-button">
                  Done
                </button>

              </div>


            </div>

          </div>

        </div>

      </div>

    </section>

  </div>

  <div v-else>

    <h1>
      {{ edited.Name }}
    </h1>

    <p class="dump-notes"
       v-if="edited.Notes">
      {{ edited.Notes }}
    </p>

    <div style="margin-bottom: 32px;"></div>

    <div class="edit-buttons">

      <button type="button"
              @click="onClickEdit"
              class="btn btn-primary bdmp-button edit-button">
        <i class="bi bi-pencil"></i>
        Edit
      </button>

      <button type="button"
              @click="onClickExport"
              class="btn btn-secondary bdmp-button edit-button">
        <i class="bi bi-box-arrow-up-right"></i>
        Export
      </button>

      <button type="button"
              @click="onClickDelete($event)"
              title="Hold down Ctrl to directly delete and skip confirmation dialog"
              class="btn btn-danger bdmp-button edit-button">
        <i class="bi bi-trash"></i>
        Delete
      </button>
    </div>

    <MdPreview :id="'md-preview'"
               :class="'md-noedit'"
               :theme="state.theme"
               :language="'en-US'"
               @onHtmlChanged="hookIntoCheckboxInputEvents"
               :model-value="edited?.Data" />

    <br />
    <br />

    <small class="timestamps">
      {{ `Created on: ${getDateTimeString(getDateFromUnixTimestamp(edited.CreationTimestampUTC))}` }}
      <br />
      {{ `Last modified on: ${getDateTimeString(getDateFromUnixTimestamp(edited.LastModificationTimestampUTC))}` }}
    </small>

  </div>

</template>

<style scoped>

.row {
  justify-content: center;
}

.save-button,
.cancel-button {
  min-width: 128px;
}

.bottom-spacer {
  margin-top: 32px;
}

.action-buttons {
  gap: 24px;
}

@media (max-width: 420px) {
  input, textarea, label {
    font-size: 0.89rem !important;
  }

  .col-12 {
    padding: 0;
  }

  .action-buttons {
    gap: 16px;
  }

  .card-body, .card-header {
    padding-left: 16px !important;
    padding-right: 16px !important;
    padding-bottom: 8px !important;
  }

  .save-button,
  .cancel-button {
    min-width: 0;
    width: 100% !important;
  }

  .bottom-spacer {
    margin-top: 16px;
  }
}

#notes {
  min-height: 61px;
  max-height: 420px;
}

.edit-buttons {
  gap: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 32px;
}

.edit-button {
}

.edit-button > i {
  margin-left: -4px;
  margin-right: 6px;
}

.md-noedit {
  background-color: transparent !important;
}

@media (max-width: 450px) {
  .edit-button {
    width: 100%;
  }
}

.dump-notes {
  opacity: 69.420%;
}

.timestamps {
  font-weight: 600;
  color: rgba(128, 128, 128, 0.69);
}

</style>