import { get } from 'lodash';
import de from '../locales/de';
import en from '../locales/en';

export default class I18n {
    /**
     * Default locale.
     */
    public locale = 'en';
    /**
     * Set the translations.
     */
    public translations: {
        [language: string]: any;
    } = {
        de,
        en,
    };

    constructor(locale?: string) {
        this.locale = locale || this.locale;
    }

    /**
     * Set another locale.
     */
    public setLocale(locale: string): void {
        this.locale = locale;
    }

    /**
     * Translate a path.
     */
    public translate(path: string, locale?: string): string {
        return get(
            this.translations[locale || this.locale] || {},
            path
        ) as string;
    }

    /**
     * Translate a path.
     */
    public $t(path: string, locale?: string): string {
        return this.translate(path, locale);
    }
}
