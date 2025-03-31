import {Constants} from "@/constants.ts";
import {Braindump} from "@/braindump.ts";
import {AES} from "@/aes.ts";

self.onmessage = async context =>
{
    let encryptedBraindumpsContext = context.data;

    let decryptedBraindumpsContext = {
        chunkIndex: encryptedBraindumpsContext.chunkIndex,
        dumps: new Array<Braindump>()
    };

    const aes: AES = new AES();

    const searchEnabled: boolean = encryptedBraindumpsContext.search && encryptedBraindumpsContext.search.length !== 0;

    for (let dump of encryptedBraindumpsContext.dumps)
    {
        if (!dump.Name || dump.Name === Constants.BRAINDUMP_ENCRYPTED_AES_KEY_ENTRY_NAME)
        {
            continue;
        }

        dump.Name = await aes.decryptString(dump.Name, encryptedBraindumpsContext.aesKey);

        if (!dump.Name)
        {
            dump.Name = Constants.DEFAULT_BRAINDUMP_NAME;
        }

        if (dump.Notes && dump.Notes.length !== 0)
        {
            dump.Notes = await aes.decryptString(dump.Notes, encryptedBraindumpsContext.aesKey);
        }

        if
        (
            dump.Name
            &&
            (
                !searchEnabled
                ||
                (
                    dump.Name.toLowerCase().replace(' ', '').includes(encryptedBraindumpsContext.search.toLowerCase())
                    ||
                    dump.Notes.toLowerCase().replace(' ', '').includes(encryptedBraindumpsContext.search.toLowerCase())
                )
            )
        )
        {
            decryptedBraindumpsContext.dumps.push(dump);
        }
    }

    self.postMessage(decryptedBraindumpsContext);
};
