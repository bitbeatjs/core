export default class Result {
    public dateTime: string;
    [property: string]: any;

    constructor(dateTime: Date = new Date()) {
        this.dateTime = dateTime.toISOString();
    }
}
