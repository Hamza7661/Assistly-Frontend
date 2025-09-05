declare module 'analogue-time-picker' {
  export function timePickerInput(args: {
    inputElement: HTMLInputElement;
    mode?: number | string;
    width?: number | string;
    time?: { hour: number | string; minute: number | string } | Date;
  }): {
    getTime: () => { hour: number; minute: number } | null;
    setTime: (hour: number | string, minute: number | string, force?: boolean) => void;
    onOk?: (cb: (hour: number, minute: number) => void) => void;
    onTimeChanged?: (cb: (hour: number, minute: number) => void) => void;
    dispose: () => void;
  };

  export function timePicker(args: any): any;
  export function timePickerModal(args: any): any;
}


