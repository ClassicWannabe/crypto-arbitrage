type Content = { text: string; image?: Buffer };

export interface Formatter {
  format(data: unknown): Promise<Content> | Content;
}
