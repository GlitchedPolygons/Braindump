<script setup
        lang="ts">

import {bytesToFileSizeString} from "@/util.ts";
import {braindumpStore} from "@/braindump.ts";

</script>

<template>

  <div>
    <span title="This quota is composed of the total sum of bytes allocated on the user account for all text content and files.">
      Storage quota:
      {{ bytesToFileSizeString(braindumpStore.user.QuotaBytes) }}
      /
      {{ bytesToFileSizeString(braindumpStore.user.MaxQuotaBytes) }}
    </span>

    <div :class="`progress ${braindumpStore.user.QuotaBytes / braindumpStore.user.MaxQuotaBytes < 0.85 ? 'progress-primary' : 'progress-danger'} mb-3`">

      <div class="progress-bar"
           role="progressbar"
           :style="`width: ${(braindumpStore.user.QuotaBytes) / braindumpStore.user.MaxQuotaBytes * 100}%`"
           aria-valuemin="0"
           :aria-valuenow="braindumpStore.user.QuotaBytes"
           :aria-valuemax="braindumpStore.user.MaxQuotaBytes"></div>
    </div>

  </div>

</template>

<style scoped>

</style>