# Arguments

Knihovnička pro Deno, která parsuje vtupní paramtery terminálu.
Umožňuje jim přiřazovat výhozí hodnoty, zpracovávat je a automaticky generovat zprávu pro `--help`.

```ts
function init() {
    const configProcessor = (v: string | null): string => {
        if (v == null)
            throw new ValueException(`Cesta konfiguračního souboru není nastavena. Nastavíte jí pomocí "--config=<path>"`)

        return join(Deno.cwd(), v);
    }


    const args = new Arguments({
        name: 'config, c',
        description: `Cesta na konfigujrační soubor ve formátu JSON.`,
        processor: configProcessor
    }, {
        name: 'port, p',
        description: `HTTP port.`,
        processor: (v: string | number) => parseInt(v.toString()),
        default: 8080,
    });

    args.setDescription('Popise mého programu.');
    
    args.setVersion('v1.0.0');
    
    args.keepProcessAlive();


    // Help
    if (args.shouldHelp()) args.triggerHelpException();


    const config = {
        port: args.get<string>('config'),
        port: args.get<number>('port'),
    }
}


try {
    await init();
} catch (error) {
    if (!Arguments.isArgumentException(error)) throw error;
}
```