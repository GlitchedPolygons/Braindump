import {reactive} from "vue";

export const braindumpStore = reactive({
    editedBraindump: null
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