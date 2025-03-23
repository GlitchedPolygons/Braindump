<script setup
        lang="ts">

import 'md-editor-v3/lib/style.css';
import {onMounted, reactive, ref} from "vue";
import {braindumpStore} from "@/braindump.ts";
import {MdEditor, MdPreview, config} from 'md-editor-v3';
import {EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {arrayBufferToHexEncodedString, getUnixTimestamp, logout} from "@/util.ts";
import bdConfig from "@/assets/config.json";
import {AES, aesKeyStore} from "@/aes.ts";

type ImgUploadCallback = (url: string) => void;

let editing = ref(true);

let edited = ref({
  Guid: '',
  CreationTimestampUTC: 0,
  LastModificationTimestampUTC: 0,
  Notes: '',
  Name: '',
  Data: '',
  Private: true,
});

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

    edited.value = braindumpStore.editedBraindump;
  }

  window.onChangedTheme = (theme: string) =>
  {
    state.theme = theme;
  };

  window.onChangedTheme(localStorage.getItem(LocalStorageKeys.THEME));
});

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

function onClickCancel(): void
{
  if (braindumpStore.editedBraindump)
  {
    edited.value = braindumpStore.editedBraindump;
  }

  editing.value = false;
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
    markdownEncryptionTask = aes.encryptString('', aesKeyStore.aesKey);
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

  const saveRequestContext = {
    method: 'POST',
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
      `${bdConfig.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}`,
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
                          maxlength="1000"
                          class="form-control"
                          v-model="edited.Notes"
                          @input="onChangedNotes"
                          placeholder="Enter an optional description of what this braindump is about."></textarea>

                <small class="unselectable"
                       :style="`margin-left: 2px; ${edited.Notes.length < 900 ? '' : edited.Notes.length < 980 ? 'color: orange' : 'color: red'}`">
                  {{ edited.Notes.length }} / 1000
                </small>

              </div>

              <MdEditor v-model="edited.Data"
                        :preview="false"
                        :maxLength="1048576"
                        :language="'en-US'"
                        :toolbars="toolbar"
                        :theme="state.theme"
                        :noUploadImg="braindumpStore.workingOffline"
                        @onUploadImg="onUploadImg"
                        @onChange="onChangedMarkdown" />

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-end"
                   style="gap: 24px;">

                <button type="button"
                        :disabled="busy"
                        @click="onClickCancel"
                        style="min-width: 128px;"
                        v-if="edited.Guid"
                        class="btn btn-secondary bdmp-button">
                  Cancel
                </button>

                <button type="button"
                        :disabled="busy"
                        style="min-width: 128px;"
                        @click="onClickSaveBraindump"
                        class="btn btn-primary bdmp-button">
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

    <MdPreview :id="'md-preview'"
               :model-value="edited?.Data" />

  </div>

</template>

<style scoped>

.row {
  justify-content: center;
}

@media (max-width: 420px) {
  input, textarea, label {
    font-size: 0.89rem !important;
  }
}

#notes {
  min-height: 61px;
  max-height: 420px;
}

</style>