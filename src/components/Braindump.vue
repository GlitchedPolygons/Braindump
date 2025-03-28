<script setup
        lang="ts">

import {nextTick, onMounted, ref} from "vue";
import config from "@/assets/config.json";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {deepClone, logout, refreshUserAccount} from "@/util.ts";
import {AES, aesKeyStore} from "@/aes.ts";
import Account from "@/components/Account.vue";
import Tools from "@/components/Tools.vue";
import BraindumpEditor from "@/components/BraindumpEditor.vue";
import ImportBraindumps from "@/components/ImportBraindumps.vue";
import ExportBraindumps from "@/components/ExportBraindumps.vue";
import {type Braindump, braindumpStore} from "@/braindump.ts";
import ListBraindumps from "@/components/ListBraindumps.vue";
import ListFiles from "@/components/ListFiles.vue";
import OfflineScratchpad from "@/components/OfflineScratchpad.vue";

const aes: AES = new AES();
const year: number = new Date().getFullYear();

let isDesktop = ref(false);
let braindumpEditorRef = ref(null);
let selectedMenuItem = ref(-1);
let refreshing: boolean = false;
let ready = ref(false);

onMounted(() =>
{
  refresh();

  window.removeEventListener("resize", onResizeWindow);
  window.addEventListener("resize", onResizeWindow);

  onResizeWindow();

  // todo: check if query param after first slash is 36 chars, and if yes: directly try to fetch braindump with that GUID and onSelectedMenuItem into the editor!

  if (braindumpStore.workingOffline === true)
  {
    onSelectedMenuItem(Constants.DEFAULT_BRAINDUMP_PAGE_INDEX_OFFLINE_MODE);
  }
});

function onResizeWindow(): void
{
  isDesktop.value = window.innerWidth >= 1200;
}

function refresh()
{
  if (refreshing)
  {
    return;
  }

  refreshing = true;

  if (braindumpStore.workingOffline)
  {
    return;
  }

  if (!localStorage.getItem(LocalStorageKeys.PASSWORD_HASH))
  {
    logout();
  }

  fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}?nameFilter=${Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME}`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  ).then(response =>
  {
    if (!response.ok)
    {
      logout();
    }

    refreshUserAccount();

    response.json().then(async responseBodyEnvelope =>
    {
      let encryptedAesKeyGuid: string = '';

      for (const entry of responseBodyEnvelope.Items)
      {
        if (entry.Name !== Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME)
        {
          continue;
        }

        encryptedAesKeyGuid = entry.Guid;
        break;
      }

      if (encryptedAesKeyGuid)
      {
        try
        {
          aesKeyStore.encryptedAesKeyGuid = encryptedAesKeyGuid;

          const aesKeyDataEntryResponse: Response = await fetch
          (
              `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}/${encryptedAesKeyGuid}`,
              {
                method: 'GET',
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
                },
              }
          );

          const aesKeyDataEntryResponseDto = await aesKeyDataEntryResponse?.json();

          if (!aesKeyDataEntryResponse.ok || !aesKeyDataEntryResponseDto || !aesKeyDataEntryResponseDto.Items)
          {
            throw new Error();
          }

          const aesKey = await aes.decryptString(aesKeyDataEntryResponseDto.Items[0].Data, localStorage.getItem(LocalStorageKeys.PASSWORD_HASH) ?? '');

          if (!aesKey)
          {
            throw new Error();
          }

          aesKeyStore.aesKey = aesKey;

          selectedMenuItem.value = Constants.DEFAULT_BRAINDUMP_PAGE_INDEX;

          ready.value = true;
        }
        catch (e)
        {
          console.error('Fatal error! Failed to fetch and/or decrypt the Braindump AES-256 encrypted key from the backend.');
          logout();
        }
      }
      else
      {
        const generatedAesKey: string = await aes.generateKey();

        aesKeyStore.aesKey = generatedAesKey;

        const aesKeyDataEntryCreationResponse: Response = await fetch
        (
            `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}`,
            {
              method: 'POST',
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
              },
              body: JSON.stringify({
                Private: true,
                Name: Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME,
                Notes: Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NOTES,
                Data: await aes.encryptString(generatedAesKey, localStorage.getItem(LocalStorageKeys.PASSWORD_HASH) ?? ''),
              }),
            }
        );

        if (!aesKeyDataEntryCreationResponse.ok)
        {
          console.error('Fatal error! Failed to generate and save Braindump AES-256 key in the proper remote data entry.');
          logout();
        }

        const aesKeyDataEntryCreationResponseBody = await aesKeyDataEntryCreationResponse.json();

        encryptedAesKeyGuid = aesKeyDataEntryCreationResponseBody.Items[0].Guid;

        aesKeyStore.encryptedAesKeyGuid = encryptedAesKeyGuid;

        selectedMenuItem.value = Constants.DEFAULT_BRAINDUMP_PAGE_INDEX;

        ready.value = true;
      }
    });
  }).catch(error =>
  {
    ready.value = false;
    logout();
  });
}

function onSelectedMenuItem(itemIndex: number)
{
  selectedMenuItem.value = itemIndex;

  if (!isDesktop.value)
  {
    const sidebar = document.getElementById("sidebar");

    sidebar?.classList.remove("active");
    sidebar?.classList.add("inactive");

    document.querySelector(".sidebar-backdrop")?.remove();
  }
}

async function onClickCreateNewBraindump(): Promise<void>
{
  onSelectedMenuItem(2);

  await nextTick();

  braindumpEditorRef.value?.onCreateNewBraindump();
}

async function openBraindump(dump: Braindump): Promise<void>
{
  const response: Response = await fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}/${dump.Guid}`,
      {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  );

  const responseBodyEnvelope = await response?.json();

  if (!response.ok || !responseBodyEnvelope || !responseBodyEnvelope.Items || responseBodyEnvelope.Items.length !== 1)
  {
    throw new Error();
  }

  const braindump: Braindump = responseBodyEnvelope.Items[0];

  dump.Guid = braindump.Guid;
  dump.Private = braindump.Private;
  dump.CreationTimestampUTC = braindump.CreationTimestampUTC;
  dump.LastModificationTimestampUTC = braindump.LastModificationTimestampUTC;
  dump.Name = await aes.decryptString(braindump.Name, aesKeyStore.aesKey);
  dump.Data = await aes.decryptString(braindump.Data, aesKeyStore.aesKey);
  dump.Notes = await aes.decryptString(braindump.Notes, aesKeyStore.aesKey);

  braindumpStore.editedBraindump = dump;

  onSelectedMenuItem(2);
}

</script>

<template>

  <div id="sidebar">
    <div class="sidebar-wrapper active">
      <div class="sidebar-header position-relative">
        <div class="d-flex justify-content-between align-items-center">

          <ThemeSwitcher :include-title-label="true" />

          <div class="sidebar-toggler x">
            <a href="javascript:void(0);"
               class="sidebar-hide d-xl-none d-block"><i class="bi bi-x bi-middle"></i></a>
          </div>
        </div>
      </div>

      <div class="sidebar-menu">

        <ul class="menu">

          <li class="sidebar-title unselectable">
            Menu
          </li>

          <li v-if="!braindumpStore.workingOffline"
              @click="onSelectedMenuItem(0)"
              :class="`sidebar-item ${selectedMenuItem === 0 ? 'active' : ''} `">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-person-circle"></i>
              <span>
                Account
              </span>
            </a>
          </li>

          <li :class="`sidebar-item ${selectedMenuItem === 1 ? 'active' : ''} `"
              @click="onSelectedMenuItem(1)">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-wrench-adjustable"></i>
              <span>
                Tools
              </span>
            </a>
          </li>

          <li class="sidebar-item "
              @click="braindumpStore.workingOffline = false; logout(!braindumpStore.workingOffline);">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-lock-fill"></i>
              <span>
                {{ braindumpStore.workingOffline ? 'Exit' : 'Logout' }}
              </span>
            </a>
          </li>

          <li style="list-style-type: none;">
            <hr />
          </li>

          <li class="sidebar-title unselectable">
            Dumps
          </li>

          <li class="sidebar-item"
              v-if="!braindumpStore.workingOffline">

            <button class="btn btn-success create-dump-button"
                    @click="onClickCreateNewBraindump">
              + Create new dump
            </button>

          </li>

          <li :class="`mt-3 sidebar-item ${selectedMenuItem === 3 ? 'active' : ''} `"
              v-if="!braindumpStore.workingOffline"
              @click="onSelectedMenuItem(3)">

            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-list"></i>
              <span>
                List
              </span>
            </a>

          </li>

          <li :class="`mt-2 sidebar-item ${selectedMenuItem === 6 ? 'active' : ''} `"
              v-if="!braindumpStore.workingOffline"
              @click="onSelectedMenuItem(6)">

            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-files"></i>
              <span>
                Files
              </span>
            </a>

          </li>

          <!--

          <li :class="`mt-2 sidebar-item ${selectedMenuItem === 4 ? 'active' : ''} `"
              v-if="!braindumpStore.workingOffline"
              @click="onSelectedMenuItem(4)">

            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-dropbox"></i>
              <span>
                Import
              </span>
            </a>

          </li>

          <li :class="`mt-2 sidebar-item ${selectedMenuItem === 5 ? 'active' : ''} `"
              v-if="!braindumpStore.workingOffline"
              @click="onSelectedMenuItem(5)">

            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-box-seam-fill"></i>
              <span>
                Export
              </span>
            </a>

          </li>

          -->

          <li :class="`mt-2 sidebar-item ${selectedMenuItem === 7 ? 'active' : ''} `"
              @click="onSelectedMenuItem(7)">

            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-wifi-off"></i>
              <span>
                Offline scratchpad
              </span>
            </a>

          </li>

        </ul>

        <div class="footer clearfix mt-lg-5 mb-0 text-muted">
          <hr />
          <div style="margin-left: 16px;">
            <p>
              Copyright &copy; 2024-{{ year }}
              <br />
              <a href="https://glitchedpolygons.com"
                 target="_blank">
                Glitched Polygons GmbH
              </a>
            </p>
          </div>
          <hr />
          <div style="margin-left: 16px;">
            <p>
              Created with <span class="text-danger"><i class="bi bi-heart-fill icon-mid"></i></span>
              by
              Raphael Beck
              <br />
              Source code available on
              <a href="https://github.com/GlitchedPolygons/Braindump"
                 target="_blank">
                GitHub <span><i class="bi bi-github"></i></span>
              </a>
            </p>
          </div>
          <hr />
        </div>

      </div>

    </div>

  </div>

  <div id="main">

    <header class="mb-3">
      <a href="javascript:void(0);"
         class="burger-btn d-block d-xl-none">
        <i class="bi bi-justify fs-3"></i>
      </a>
    </header>

    <div class="page-heading">

      <!--
      <h3>
        Braindump
      </h3>
      -->

    </div>

    <div class="page-content">

      <Account v-if="selectedMenuItem === 0" />

      <Tools v-if="selectedMenuItem === 1" />

      <BraindumpEditor ref="braindumpEditorRef"
                       v-if="selectedMenuItem === 2"
                       @onCloseEditor="braindumpStore.editedBraindump = deepClone(Constants.DEFAULT_BRAINDUMP); onSelectedMenuItem(3);" />

      <ListBraindumps v-if="selectedMenuItem === 3"
                      @onSelectBraindump="openBraindump" />

      <ImportBraindumps v-if="selectedMenuItem === 4" />

      <ExportBraindumps v-if="selectedMenuItem === 5" />

      <ListFiles v-if="selectedMenuItem === 6" />

      <OfflineScratchpad v-if="selectedMenuItem === 7" />

    </div>

    <!--
    <footer>
      <div class="footer clearfix mb-0 text-muted">
        <div class="float-start">
          <p>
            Copyright &copy; 2024-{{ year }}
            <br />
            <a href="https://glitchedpolygons.com"
               target="_blank">
              Glitched Polygons GmbH
            </a>
          </p>
        </div>
        <div class="float-end">
          <p>
            Created with <span class="text-danger"><i class="bi bi-heart-fill icon-mid"></i></span>
            by
            Raphael Beck
            <br />
            Source code available on
            <a href="https://github.com/GlitchedPolygons/Braindump"
               target="_blank">
              GitHub <span><i class="bi bi-github"></i></span>
            </a>
          </p>
        </div>
      </div>
    </footer>
    -->

  </div>

</template>

<style scoped>

.page-content {
  min-height: 1024px;
}

.create-dump-button {
  width: 100%;
  height: 46px;
  border-radius: 0.5rem !important;
  font-weight: bold !important;
}

.sidebar-wrapper {
  /* border-right: solid #73737321 1px; */
}

hr {
  color: rgba(172, 172, 172, 0.69) !important;
}

@media (max-width: 420px) {
  .page-heading {
    margin-bottom: 0 !important;
  }
}

</style>