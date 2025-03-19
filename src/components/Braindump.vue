<script setup
        lang="ts">

import {onMounted, ref} from "vue";
import config from "@/assets/config.json";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import {Constants, EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {logout} from "@/util.ts";
import {AES, aesKeyStore} from "@/aes.ts";
import Account from "@/components/Account.vue";
import Tools from "@/components/Tools.vue";
import BraindumpEditor from "@/components/BraindumpEditor.vue";
import {type Braindump, braindumpStore} from "@/braindump.ts";

const aes: AES = new AES();
const year: number = new Date().getFullYear();

let selectedMenuItem = ref(0);
let dumps: Array<Braindump> = [];
let refreshing: boolean = false;
let ready: boolean = false;

onMounted(() =>
{
  refresh();
});

function refresh()
{
  if (refreshing)
  {
    return;
  }

  refreshing = true;

  fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}?nameFilter=${Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME}`,
      {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  ).then(response =>
  {
    if (!response.ok)
    {
      logout();
    }

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

          ready = true;
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

        ready = true;
      }
    });
  }).catch(error =>
  {
    ready = false;
    logout();
  });

  fetch
  (
      `${config.BackendBaseURL}${EndpointURLs.DATA_ENTRIES}`,
      {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
        },
      }
  ).then(response =>
  {
    if (!response.ok)
    {
      //  logout();
    }

    response.json().then((responseBodyEnvelope) =>
    {
      if (responseBodyEnvelope.Type !== TypeNamesDTO.USER_DATA_REDUX_RESPONSE_DTO)
      {
        //logout();
      }
    });
  }).catch(error =>
  {
    // logout();
  });
}

function onSelectedMenuItem(itemIndex: number)
{
  selectedMenuItem.value = itemIndex;
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

          <li :class="`sidebar-item ${selectedMenuItem === 0 ? 'active' : ''}`"
              @click="onSelectedMenuItem(0)">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-person-circle"></i>
              <span>
                Account
              </span>
            </a>
          </li>

          <li :class="`sidebar-item ${selectedMenuItem === 1 ? 'active' : ''}`"
              @click="onSelectedMenuItem(1)">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-wrench-adjustable"></i>
              <span>
                Tools
              </span>
            </a>
          </li>

          <li class="sidebar-item"
              @click="logout();">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-lock-fill"></i>
              <span>
                Logout
              </span>
            </a>
          </li>

          <!--
          <li class="sidebar-item has-sub">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-stack"></i>
              <span>Dumps</span>
            </a>

            <ul class="submenu">
              <li class="submenu-item">
                <a href="component-accordion.html"
                   class="submenu-link">Accordion</a>
              </li>

              <li class="submenu-item">
                <a href="component-alert.html"
                   class="submenu-link">Alert</a>
              </li>
            </ul>
          </li>
          -->

          <li style="list-style-type: none;">
            <hr />
          </li>

          <li class="sidebar-title unselectable">
            Dumps
          </li>

          <li class="sidebar-item">

            <button class="btn btn-success create-dump-button"
                    @click="braindumpStore.editedBraindump = null; onSelectedMenuItem(2)">
              + Create new dump
            </button>

          </li>

          <li class="sidebar-item"
              v-for="dump in dumps">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-journal-richtext"></i>
              <span>{{ dump.Name }}</span>
            </a>
          </li>

        </ul>

        <div class="footer clearfix mt-5 mb-0 text-muted">
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

      <BraindumpEditor v-if="selectedMenuItem === 2" />

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
  font-weight: bold !important;
}

</style>