interface JSONSchema {
    type:
        | (
              | 'object'
              | 'array'
              | 'string'
              | 'number'
              | 'boolean'
              | 'buffer'
              | 'null'
          )
        | (
              | 'object'
              | 'array'
              | 'string'
              | 'number'
              | 'boolean'
              | 'buffer'
              | 'null'
          )[];
    $id?: string;
    $ref?: string;
    title?: string;
    description?: string;
    properties?: {
        [property: string]: JSONSchema;
    };
    patternProperties?: {
        [pattern: string]: JSONSchema;
    };
    dependencies?: {
        [key: string]: JSONSchema | string[];
    };
    required?: string[];
    default?: any;
    enum?: any[];
    additionalItems?: boolean | JSONSchema;
    additionalProperties?: boolean | JSONSchema;
    items?: JSONSchema | JSONSchema[];
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;

    pattern?: string;
    maxLength?: number;
    minLength?: number;

    multipleOf?: number;
    maximum?: number;
    exclusiveMinimum?: boolean;
    minimum?: number;
    exclusiveMaximum?: boolean;

    definitions?: {
        [key: string]: JSONSchema;
    };

    allOf?: JSONSchema[];
    anyOf?: JSONSchema[];
    oneOf?: JSONSchema[];
    not?: JSONSchema;
    nullable?: boolean;
    example?: any;
    validator?: (x: JSONSchema['type']) => void | boolean;
    formatter?: (x: JSONSchema['type']) => void | any;
}

export { JSONSchema };
