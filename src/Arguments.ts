/**
 * @copyright Copyright (c) 2022 Adam Josefus
 */
import { Command, Flag, parse } from "./model/parse.ts";
import { primary, secondary } from "./helpers/colors.ts";
import { InfoInterruption } from "./InfoInterruption.ts";
import { PrintableException } from "./PrintableException.ts";


type FlagOptions<T> = {
    convertor: Convertor<T>,
    shortName?: string,
    description?: string,
    default?: () => T,
    excludeFromHelp?: boolean,
}

interface FlagDeclaration {
    longName: string,
    shortName: string | undefined,
    description: string[],
    default: (() => unknown) | undefined,
    convertor: Convertor<unknown>,
    excludeFromHelp: boolean,
}


export type Convertor<T> = {
    (value: undefined | string | boolean): T | undefined;
}

// Convertors
export const booleanConvertor: Convertor<boolean> = v => {
    if (v === undefined) return false;
    if (v === null) return false;
    if (v === false) return false;
    if (v === true) return true;

    const s = `${v}`.toLowerCase().trim();

    if (s === 'true') return true;
    if (s === '1') return true;

    return true;
}

export const stringConvertor: Convertor<string> = v => {
    if (v === undefined) return undefined;

    return `${v}`;
}

export const numberConvertor: Convertor<number> = v => {
    if (v === undefined) return undefined;

    return Number(v);
}


const helpFlagNames = ['help', 'h'] as const;

const normalizeName = (name: string) => name.trim().toLowerCase();
const normalizeShortName = (name: string) => normalizeName(name).substring(0, 1);

const createFlagDeclarations = (options: Record<string, FlagOptions<unknown>>) => {
    const entries = Object.entries(options)
        .map(([name, op]) => {
            return {
                longName: normalizeName(name),
                shortName: op.shortName ? normalizeShortName(op.shortName) : undefined,
                description: op.description?.trim().split('\n') ?? undefined,
                default: op.default,
                convertor: op.convertor,
                excludeFromHelp: op.excludeFromHelp ?? false,
            }
        })
        .map(declaration => [declaration.longName, declaration] as [string, FlagDeclaration]);

    return new Map(entries);
}

type FlagOptionMap = {
    [longName: string]: FlagOptions<unknown>,
}


export class Arguments<T extends FlagOptionMap, FlagValues = { [longName in keyof T]: ReturnType<T[longName]['convertor']> | undefined }> {

    #rawArgs: readonly Readonly<Flag | Command>[];

    #flagDeclarations: Map<string, FlagDeclaration> = new Map();

    #desciprion: string | null = null;


    constructor(flagOptions: T) {
        this.#flagDeclarations = createFlagDeclarations(flagOptions);
        this.#rawArgs = parse(Deno.args);
    }


    getFlags(): FlagValues {
        const entries = Array.from(this.#flagDeclarations.keys())
            .map(longName => {
                const value = this.#getFlagValue(longName);
                return [longName, value] as [string, unknown];
            })

        return Object.fromEntries(entries) as FlagValues;
    }


    setDesciprion(description: string) {
        this.#desciprion = description.trim();

        return this;
    }


    #getRaw(name: string, tag: 'Flag'): Flag | undefined;
    #getRaw(name: string, tag: 'Command'): Flag | undefined;
    #getRaw(name: string, tag: 'Flag' | 'Command'): unknown | undefined {
        const flag = this.#rawArgs.filter(arg => arg._tag === tag) // Filter out commands
            .find(f => normalizeName(name) === normalizeName(f.name));

        return flag;
    }


    #getFlagValue<T>(name: string): T | undefined {
        const notFoundMessage = `Argument "${name}" is not declared.`;
        const getRawFlag = (name: string) => this.#getRaw(name, 'Flag');

        const dec = this.#flagDeclarations.get(normalizeName(name));
        if (!dec) throw new Error(notFoundMessage);

        const flag = getRawFlag(dec.longName);
        if (!flag) throw new Error(notFoundMessage);

        const rawValue = getRawFlag(dec.longName)?.value;
        const value = (rawValue !== undefined ? dec.convertor(rawValue) : dec.default?.() ?? undefined) as T | undefined;

        return value;
    }


    isHelpRequested(): boolean {
        return this.#getFlagValue(helpFlagNames[0]) === true;
    }


    /**
     * @deprecated Use `isHelpRequested` instead.
     */
    shouldHelp() {
        return this.isHelpRequested();
    }


    keepProcessAlive(message = 'Press Enter key to exit the process...') {
        globalThis.addEventListener('unload', () => {
            prompt(message);
        }, { once: true });
    }


    triggerHelp() {
        throw new InfoInterruption(this.computeHelpMessage());
    }


    computeHelpMessage(): string {
        const tab = (n = 1) => ' '.repeat(Math.max(n, 1) * 2);

        const declarations = Array.from(this.#flagDeclarations.entries())
            .map(([_, dec]) => dec)
            .filter(({ excludeFromHelp }) => !excludeFromHelp)
            .map(dec => {
                const names = (indent: number) => {
                    const long = `--${dec.longName}`;
                    const short = dec.shortName ? `-${dec.shortName}` : '';

                    const text = [long, short]
                        .filter(n => n !== '')
                        .map(n => primary(n))
                        .join(', ');

                    return tab(indent) + text;
                }

                const description = (indent: number) => dec.description
                    .map(l => secondary(l))
                    .map(l => tab(indent) + l)
                    .join('\n');

                const defaultValue = (indent: number) => {
                    if (dec.default === undefined) return '';

                    const serialized = Deno.inspect(dec.default(), {
                        colors: true,
                        compact: false,
                    }).split('\n');

                    return tab(indent) + secondary(`Default: `) + serialized.join('\n' + tab(indent + 2));
                }

                return [
                    names(1),
                    description(2),
                    defaultValue(2),
                ].filter(s => s !== '').join('\n');
            }).join('\n\n');


        const description: string = this.#desciprion ?? '';

        return [
            `\n${description}`,
            `\n${declarations}`
        ].filter(s => s.trim() !== '').join('\n');
    }


    static isPrintableException(error: Error): boolean {
        return error instanceof PrintableException;
    }


    static rethrowUnprintableException(error: Error) {
        if (!(error instanceof PrintableException)) throw error;
    }


    static createHelp() {
        return {
            [helpFlagNames[0]]: {
                convertor: booleanConvertor,
                shortName: helpFlagNames[1],
                description: 'Show this help message.',
                excludeFromHelp: true,
            } as const
        } as const
    }


    static booleanConvertor = booleanConvertor;
    static numberConvertor = numberConvertor;
    static stringConvertor = stringConvertor;
}
