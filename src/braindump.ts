import {reactive} from "vue";

declare type BraindumpRedux = {
    Guid: string,
    Name: string,
    Notes: string
}

export class Braindump {
    Guid: string = '';
    CreationTimestampUTC: number = 0;
    LastModificationTimestampUTC: number = 0;
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
    LastModificationTimestampUTC: number = 0;
}

export const braindumpStore = reactive({
    editedBraindump: new Braindump(),
    braindumps: [] as Braindump[],
    workingOffline: false,
    defibrillatorToken: '',
    user: {} as any
});