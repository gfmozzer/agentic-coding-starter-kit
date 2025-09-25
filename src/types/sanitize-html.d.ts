declare module "sanitize-html" {
  export interface IOptions {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowProtocolRelative?: boolean;
    transformTags?: Record<string, (...args: any[]) => any>;
  }
  interface SanitizeHtmlStatic {
    (dirty: string, options?: IOptions): string;
    defaults: IOptions;
    simpleTransform: (
      tagName: string,
      attribs?: Record<string, string>,
      merge?: boolean
    ) => (attribs: Record<string, string>) => Record<string, string>;
  }
  const sanitizeHtml: SanitizeHtmlStatic;
  export default sanitizeHtml;
}
