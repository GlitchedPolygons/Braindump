<script setup
        lang="ts">

import {nextTick, onMounted, reactive, ref} from "vue";

import {
  deepClone,
  getDateFromUnixTimestamp,
  getDateTimeString,
  getUnixTimestamp,
  save,
  toggleCheckboxInMarkdown
} from "@/util.ts";

import {type Braindump} from "@/braindump.ts";
import {Constants, LocalStorageKeys} from "@/constants.ts";
import {config, MdEditor, MdPreview} from "md-editor-v3";

const state = reactive({
  text: '',
  theme: 'dark',
});

let editing = ref(false);
let hideHelpText = ref(false);
let scratchpad = ref(deepClone(Constants.DEFAULT_BRAINDUMP) as Braindump);

let saveDebounce: number | null = null;

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
  hideHelpText.value = localStorage.getItem(LocalStorageKeys.HIDE_OFFLINE_MODE_HELP_TEXT) === 'true';

  const storedScratchpadJson: string = localStorage.getItem(LocalStorageKeys.OFFLINE_SCRATCHPAD) ?? '';

  if (storedScratchpadJson && storedScratchpadJson.length !== 0)
  {
    scratchpad.value = JSON.parse(storedScratchpadJson);
  }

  hookIntoCheckboxInputEvents();

  window.onChangedTheme = (theme: string) =>
  {
    state.theme = theme;
  };

  window.onChangedTheme(localStorage.getItem(LocalStorageKeys.THEME));
});

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

function onClickEdit(): void
{
  editing.value = true;
}

function onClickDone(): void
{
  editing.value = false;
}

function onClickExport(): void
{
  save(scratchpad.value.Data, `${new Date().toISOString()}.md`);
}

function onChangedMarkdown(markdown: string): void
{
  if (saveDebounce !== null)
  {
    window.clearTimeout(saveDebounce);
  }

  saveDebounce = window.setTimeout(() =>
  {
    saveDebounce = null;

    scratchpad.value.LastModificationTimestampUTC = getUnixTimestamp();

    localStorage.setItem(LocalStorageKeys.OFFLINE_SCRATCHPAD, JSON.stringify(scratchpad.value));
  }, 256);
}

function onClickCheckbox(clickEvent: Event): void
{
  if (editing.value === true)
  {
    return;
  }

  toggleCheckboxInMarkdown(clickEvent, scratchpad);

  onChangedMarkdown(scratchpad.value.Data);
}

function onClickHideHelpText(): void
{
  hideHelpText.value = true;
  localStorage.setItem(LocalStorageKeys.HIDE_OFFLINE_MODE_HELP_TEXT, 'true');
}

function onClickShowHelpText(): void
{
  hideHelpText.value = false;
  localStorage.setItem(LocalStorageKeys.HIDE_OFFLINE_MODE_HELP_TEXT, 'false');
}

</script>

<template>

  <div class="page-title">

    <div class="row">

      <div class="col-12 order-md-1 order-last">

        <h3>
          Offline scratchpad <sup><span class="badge bg-primary show-help-text-badge"
                                        title="Show help text"
                                        v-if="hideHelpText"
                                        @click="onClickShowHelpText">?</span></sup>
        </h3>

        <p class="text-subtitle text-muted"
           v-if="!hideHelpText">
          This is your offline Braindump instance where you can quick-dump stuff that you don't want to synchronize with
          the server (or that you need even without an active internet connection, provided that you have downloaded the
          website onto your device).
        </p>

        <p class="text-subtitle text-muted"
           v-if="!hideHelpText">
          Edit the braindump text content using the great
          <a href="https://www.markdownguide.org/getting-started/"
             target="_blank">Markdown</a>
          syntax with this editor.<br />
          Changes are saved automatically. <span class="badge bg-primary hide-help-text-badge"
                                                 title="Hide help text"
                                                 @click="onClickHideHelpText">Hide</span>
        </p>

      </div>

    </div>

  </div>

  <div v-if="editing">

    <MdEditor v-model="scratchpad.Data"
              :id="'md-editor'"
              :preview="false"
              :maxLength="4194304"
              :language="'en-US'"
              :toolbars="Constants.TOOLBAR"
              :theme="state.theme"
              :noUploadImg="true"
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

  <div v-else
       class="mt-2">

    <div class="edit-buttons">

      <button type="button"
              @click="onClickEdit"
              class="btn btn-primary bdmp-button edit-button">
        <i class="bi bi-pencil"></i>
        Edit
      </button>

      <button type="button"
              @click="onClickExport"
              :disabled="!scratchpad || !scratchpad.Data || scratchpad.Data.length === 0"
              class="btn btn-secondary bdmp-button edit-button">
        <i class="bi bi-box-arrow-up-right"></i>
        Export
      </button>
    </div>

    <MdPreview :id="'md-preview'"
               :class="'md-noedit'"
               :theme="state.theme"
               :language="'en-US'"
               @onHtmlChanged="hookIntoCheckboxInputEvents"
               :model-value="scratchpad?.Data" />

    <br />
    <br />

    <small class="timestamps"
           v-if="scratchpad && scratchpad.LastModificationTimestampUTC !== 0">
      {{ `Last modified on: ${getDateTimeString(getDateFromUnixTimestamp(scratchpad.LastModificationTimestampUTC))}` }}
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

.timestamps {
  font-weight: 600;
  color: rgba(128, 128, 128, 0.69);
}

.md-editor {
  min-height: 777px;
}

</style>