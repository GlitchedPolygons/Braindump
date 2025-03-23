import {reactive} from "vue";

export const braindumpStore = reactive({
    editedBraindump: null,
    draft: {
        notes: '',
        markdown: ''
    },
    loggedIn: false,
    workingOffline: false,
});

export type Braindump = {
    Guid: string;
    CreationTimestampUTC: number;
    LastModificationTimestampUTC: number | null;
    Notes: string;
    Name: string;
    Data: string;
    Private: boolean;
};