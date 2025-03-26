<script setup
        lang="ts">

import 'md-editor-v3/lib/style.css';
import {onMounted, reactive, ref, toRaw, nextTick} from "vue";
import {braindumpStore} from "@/braindump.ts";
import {MdEditor, MdPreview, config} from 'md-editor-v3';
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {
  arrayBufferToHexEncodedString,
  deepClone,
  exportBraindump, getDateFromUnixTimestamp,
  getDateTimeString,
  getUnixTimestamp,
  logout
} from "@/util.ts";
import bdConfig from "@/assets/config.json";
import {AES, aesKeyStore} from "@/aes.ts";

type ImgUploadCallback = (url: string) => void;

let editing = ref(true);

let edited = ref(deepClone(Constants.DEFAULT_BRAINDUMP));

let nameEncryptionTask: Promise<string>;
let notesEncryptionTask: Promise<string>;
let markdownEncryptionTask: Promise<string>;

let busy = ref(false);

const aes: AES = new AES();

const state = reactive({
  text: '',
  theme: 'dark',
});

const toolbar = [
  'revoke',
  'next',

  '-',

  'task',
  'unorderedList',
  'orderedList',

  '-',

  'bold',
  'italic',
  'strikeThrough',

  '-',

  'title',
  'sub',
  'sup',

  '-',

  'quote',
  'codeRow',
  'code',

  '-',

  'link',
  'image',
  'table',
  'mermaid',
  'katex',

  '=',

  'pageFullscreen',
  'preview',
  'previewOnly',
];

defineExpose({onCreateNewBraindump});

const emit = defineEmits(['onDeleteOpenDump']);

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
  if (braindumpStore.editedBraindump)
  {
    editing.value = false;

    edited.value = deepClone(toRaw(braindumpStore.editedBraindump));
  }

  window.onChangedTheme = (theme: string) =>
  {
    state.theme = theme;
  };

  window.onChangedTheme(localStorage.getItem(LocalStorageKeys.THEME));

  hookIntoCheckboxInputEvents();
});

function hookIntoCheckboxInputEvents(): void
{
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
  // TODO: modify and save markdown accordingly
}

function onChangedName(changeEvent: Event)
{
  const element = changeEvent.target as HTMLInputElement;

  if (!element || !element.value)
  {
    nameEncryptionTask = new Promise<string>(() => '');
    return;
  }

  nameEncryptionTask = aes.encryptString(element?.value ?? '', aesKeyStore.aesKey);
}

function onChangedNotes(changeEvent: Event)
{
  const element = changeEvent.target as HTMLInputElement;

  if (!element || !element.value)
  {
    notesEncryptionTask = new Promise<string>(() => '');
    return;
  }

  notesEncryptionTask = aes.encryptString(element.value, aesKeyStore.aesKey);
}

function onChangedMarkdown(markdown: string): void
{
  markdownEncryptionTask = aes.encryptString(markdown, aesKeyStore.aesKey);

  hookIntoCheckboxInputEvents();
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

function onClickCancel(): void
{
  if (braindumpStore.editedBraindump)
  {
    edited.value = deepClone(toRaw(braindumpStore.editedBraindump));
  }

  editing.value = false;
}

async function onClickExport(): Promise<void>
{
  exportBraindump(edited.value.Guid);
}

async function onClickDelete(): Promise<void>
{
  if (!edited.value)
  {
    return;
  }

  if (!confirm(`Are you sure that you want to delete Braindump "${edited.value.Name}"?`))
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

  emit('onDeleteOpenDump');
}

async function onClickSaveBraindump(): Promise<void>
{
  if (!edited.value.Name)
  {
    alert('Please enter a name for your braindump.');
    return;
  }

  if (edited.value.Notes === null || edited.value.Notes === ' ')
  {
    edited.value.Notes = '';
    notesEncryptionTask = new Promise<string>(() => '');
  }

  if (!edited.value.Data)
  {
    edited.value.Data = '';
    onChangedMarkdown('');
  }

  if (!markdownEncryptionTask)
  {
    markdownEncryptionTask = aes.encryptString(edited.value.Data, aesKeyStore.aesKey);
  }

  if (!notesEncryptionTask)
  {
    notesEncryptionTask = aes.encryptString(edited.value.Notes, aesKeyStore.aesKey);
  }

  if (!nameEncryptionTask)
  {
    nameEncryptionTask = aes.encryptString(edited.value.Name, aesKeyStore.aesKey);
  }

  if (busy.value === true)
  {
    return;
  }

  busy.value = true;

  const encryptedName = nameEncryptionTask ? await nameEncryptionTask : '';
  const encryptedNotes = notesEncryptionTask ? await notesEncryptionTask : '';
  const encryptedMarkdown = markdownEncryptionTask ? await markdownEncryptionTask : '';

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
  edited.value.Name = createdBraindumpResponseDto.Name ? await aes.decryptString(createdBraindumpResponseDto.Name, aesKeyStore.aesKey) : '';
  edited.value.Notes = createdBraindumpResponseDto.Notes ? await aes.decryptString(createdBraindumpResponseDto.Notes, aesKeyStore.aesKey) : '';

  braindumpStore.editedBraindump = deepClone(toRaw(edited.value));

  editing.value = false;
}

</script>

<template>

  <div v-if="editing">

    <div class="page-title">

      <div class="row">

        <div class="col-12 order-md-1 order-last">

          <h3>
            Editor
          </h3>

          <p class="text-subtitle text-muted">
            Create or modify a braindump using the great <a href="https://www.markdownguide.org/getting-started/"
                                                            target="_blank">Markdown</a> syntax with this editor.
          </p>

        </div>

      </div>

    </div>

    <section class="section">

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
                       v-on:keyup.enter="onClickSaveBraindump();"
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
                        :toolbars="toolbar"
                        :theme="state.theme"
                        :noUploadImg="braindumpStore.workingOffline"
                        @onUploadImg="onUploadImg"
                        @onChange="onChangedMarkdown" />

              <div class="bottom-spacer"></div>

              <div class="form-group my-2 d-flex justify-content-end action-buttons">

                <button type="button"
                        :disabled="busy"
                        @click="onClickCancel"
                        v-if="edited.Guid"
                        class="btn btn-secondary bdmp-button cancel-button">
                  Cancel
                </button>

                <button type="button"
                        :disabled="busy"
                        @click="onClickSaveBraindump"
                        class="btn btn-primary bdmp-button save-button">
                  {{ edited.Guid ? 'Save' : 'Create' }}
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
              @click="onClickDelete"
              class="btn btn-danger bdmp-button edit-button">
        <i class="bi bi-trash"></i>
        Delete
      </button>
    </div>

    <MdPreview :id="'md-preview'"
               :class="'md-noedit'"
               :theme="state.theme"
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