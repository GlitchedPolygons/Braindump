import {reactive} from "vue";

export class Braindump {
    Guid: string = '';
    CreationTimestampUTC: number = 0;
    LastModificationTimestampUTC: number | null = null;
    Notes: string = '';
    Name: string = '';
    Data: string = '';
    Private: boolean = true;
};

export const braindumpStore = reactive({
    braindumps: [],
    editedBraindump: new Braindump(),
    loggedIn: false,
    workingOffline: false,
});