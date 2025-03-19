<script setup
        lang="ts">

import {onMounted, ref} from "vue";
import {braindumpStore} from "@/braindump.ts";

let editing = ref(true);

onMounted(() =>
{
  if (braindumpStore.editedBraindump)
  {
    // todo: start in edit mode
  }
  else
  {
    // todo: start in reading mode
  }
  
  // todo
});

</script>

<template>

</template>

<style scoped>

</style>