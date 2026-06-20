// Minimal Jest globals for the legacy frontend smoke tests included in tsc scope.
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;
declare const jest: any;
