export class Exception {
    public constructor(public cause: string | null, column: number | null, line: number | null, message: string, stacktrace: any[], url: string) {

    }
}