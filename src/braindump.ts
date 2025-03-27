import {reactive} from "vue";

export class Braindump {
    Guid: string = '';
    CreationTimestampUTC: number = 0;
    LastModificationTimestampUTC: number | null = null;
    Notes: string = '';
    Name: string = '';
    Data: string = '';
    Private: boolean = true;
}

export class BraindumpFile {
    Guid: string = '';
    Notes: string = '';
    SHA256: string = '';
    FileName: string = '';
    FileSizeBytes: number = 0;
    CreationTimestampUTC: number = 0;
    LastModificationTimestampUTC: number | null = null;
}

export const braindumpStore = reactive({
    editedBraindump: new Braindump(),
    braindumps: [],
    workingOffline: false,
    defibrillatorToken: '',
    user: {}
});