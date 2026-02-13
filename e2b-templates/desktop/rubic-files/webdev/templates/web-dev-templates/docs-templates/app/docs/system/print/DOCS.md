---
name: print
description: Print documents and images.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Print

A library that provides printing functionality for Android and iOS (AirPrint).

**Platforms:** android, ios, web

**Package:** `expo-print`

`expo-print` provides an API for Android and iOS (AirPrint) printing functionality.

## Quick Start

This example shows how to print a simple HTML string. On web, this will open the browser's print dialog. On mobile, it will open the native printing UI.

```jsx
import { View, Button, Platform } from 'react-native';
import * as Print from 'expo-print';

const htmlContent = `
  <html>
    <body>
      <h1>Hello, Expo!</h1>
      <p>This is a test print from an Expo app.</p>
    </body>
  </html>
`;

export default function App() {
  const print = async () => {
    if (Platform.OS !== 'web') {
      await Print.printAsync({ html: htmlContent });
    } else {
      // On web, printAsync opens the browser's print dialog
      await Print.printAsync({});
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Print" onPress={print} />
    </View>
  );
}
```

## When to Use

Use `expo-print` when you need to provide users with the ability to print documents, images, or other content from your app. It's ideal for applications that generate invoices, tickets, reports, or any other printable material.

## Common Pitfalls

1.  **Printing Local Images on iOS**:
    *   **Problem**: On iOS, `WKWebView` does not support rendering local image files (e.g., `file:///...`) directly in the HTML source for printing.
    *   **Solution**: Convert the image to a base64 string and embed it directly in the HTML using a data URI.

    ```jsx
    import { Asset } from 'expo-asset';
    import * as FileSystem from 'expo-file-system';
    import * as Print from 'expo-print';

    async function printImage() {
      const image = Asset.fromModule(require('./assets/my-image.png'));
      await image.downloadAsync();

      const imageBase64 = await FileSystem.readAsStringAsync(image.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const html = `
        <html>
          <body>
            <img src="data:image/png;base64,${imageBase64}" style="width: 100%;" />
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    }
    ```

2.  **Web Printing Behavior**:
    *   **Problem**: Calling `printAsync` with an `html` option on the web does not print the provided HTML. Instead, it prints the current web page's content.
    *   **Solution**: To print specific content on the web, you need to either open a new window with that content or dynamically replace the current page's content before printing. For most use cases, simply calling `printAsync({})` to print the visible screen is sufficient.

3.  **Incorrectly Handling `printToFileAsync` URI**:
    *   **Problem**: The `uri` returned by `printToFileAsync` points to a temporary file in the app's cache directory. This file may be deleted by the OS at any time.
    *   **Solution**: If you need to persist the PDF, move it to a permanent location using `expo-file-system`.

    ```jsx
    import * as Print from 'expo-print';
    import * as FileSystem from 'expo-file-system';
    import * as Sharing from 'expo-sharing';

    async function savePdf() {
      const { uri } = await Print.printToFileAsync({ html: '<h1>My PDF</h1>' });
      const newUri = `${FileSystem.documentDirectory}my-pdf.pdf`;
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });
      await Sharing.shareAsync(newUri);
    }
    ```

## Common Patterns

### Printing a PDF from a URI

This pattern is useful when you have a PDF file (either local or remote) that you want to print.

```jsx
import { Button, View } from 'react-native';
import * as Print from 'expo-print';

export default function App() {
  const printPdf = async () => {
    await Print.printAsync({ uri: 'https://www.orimi.com/pdf-test.pdf' });
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Print PDF" onPress={printPdf} />
    </View>
  );
}
```

### Generating a PDF and Sharing It

This pattern creates a PDF from HTML content and then uses the `expo-sharing` library to let the user share it with other apps.

```jsx
import { Button, View } from 'react-native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

const html = '<html><body><h2>My Report</h2><p>This is the content of my report.</p></body></html>';

export default function App() {
  const generateAndSharePdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share PDF' });
    } catch (error) {
      console.error('Failed to generate and share PDF:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Generate and Share PDF" onPress={generateAndSharePdf} />
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-print
```

## Usage

```jsx
import { useState } from 'react';
import { View, StyleSheet, Button, Platform, Text } from 'react-native';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

const html = `
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
  </head>
  <body style="text-align: center;">
    <h1 style="font-size: 50px; font-family: Helvetica Neue; font-weight: normal;">
      Hello Expo!
    </h1>
    <img
      src="https://d30j33t1r58ioz.cloudfront.net/static/guides/sdk.png"
      style="width: 90vw;" />
  </body>
</html>
`;

export default function App() {
  const [selectedPrinter, setSelectedPrinter] = useState();

  const print = async () => {
    // On iOS/android prints the given html. On web prints the HTML from the current page.
    /* @info */ await Print.printAsync({
      html,
      printerUrl: selectedPrinter?.url, // iOS only
    }); /* @end */
  };

  const printToFile = async () => {
    // On iOS/android prints the given html. On web prints the HTML from the current page.
    /* @info */ const { uri } = await Print.printToFileAsync({ html }); /* @end */
    console.log('File has been saved to:', uri);
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  };

  const selectPrinter = async () => {
    /* @info */ const printer = await Print.selectPrinterAsync(); // iOS only
    /* @end */
    setSelectedPrinter(printer);
  };

  return (
    <View style={styles.container}>
      <Button title="Print" onPress={print} />
      <View style={styles.spacer} />
      <Button title="Print to PDF file" onPress={printToFile} />
      {Platform.OS === 'ios' && (
        <>
          <View style={styles.spacer} />
          <Button title="Select printer" onPress={selectPrinter} />
          <View style={styles.spacer} />
          {selectedPrinter ? (
            <Text style={styles.printer}>{`Selected printer: ${selectedPrinter.name}`}</Text>
          ) : undefined}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    flexDirection: 'column',
    padding: 8,
  },
  spacer: {
    height: 8,
  },
  printer: {
    textAlign: 'center',
  },
});
```

## API
```js
import * as Print from 'expo-print';
```

## Local images

On iOS, printing from HTML source doesn't support local asset URLs (due to `WKWebView` limitations). Instead, images need to be converted to base64 and inlined into the HTML.

**Example:** Example
```tsx

const IMAGE = Asset.fromModule(require('@/assets/images/icon.png'));

export function ImageManipulatorExample() {
  const context = useImageManipulator(IMAGE.uri);

  useEffect(() => {
    async function generateAndPrint() {
      try {
        await IMAGE.downloadAsync();
        const manipulatedImage = await context.renderAsync();
        const result = await manipulatedImage.saveAsync({ base64: true });

        const html = `
          <html>
            <img
              src="data:image/png;base64,${result.base64}"
              style="width: 90vw;" />
          </html>
        `;

        await printAsync({ html });
      } catch (error) {
        console.error('Error:', error);
      }
    }

    generateAndPrint();
  }, [context]);

  return <></>;
}
```

## Page margins

**On iOS** you can set the page margins using the `margins` option:

```js
const { uri } = await Print.printToFileAsync({
  html: 'This page is printed with margins',
  margins: {
    left: 20,
    top: 50,
    right: 20,
    bottom: 100,
  },
});
```

If `useMarkupFormatter` is set to `true`, setting margins may cause a blank page to appear at the end of your printout. To prevent this, make sure your HTML string is a well-formed document, including `<!DOCTYPE html>` at the beginning of the string.

**On Android**, if you're using `html` option in `printAsync` or `printToFileAsync`, the resulting print might contain page margins (it depends on the WebView engine).
They are set by `@page` style block and you can override them in your HTML code:

```html
<style>
  @page {
    margin: 20px;
  }
</style>
```

See [`@page` documentation on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@page) for more details.

## API Reference

### Methods

#### printAsync
Prints a document or HTML, on web this prints the HTML from the page.
> Note: On iOS, printing from HTML source doesn't support local asset URLs (due to `WKWebView`
> limitations). As a workaround you can use inlined base64-encoded strings.
> See [this comment](https://github.com/expo/expo/issues/7940#issuecomment-657111033) for more details.

> Note: on iOS, when printing without providing a `PrintOptions.printerUrl` the `Promise` will be
> resolved once printing is started in the native print window and rejected if the window is closed without
> starting the print. On Android the `Promise` will be resolved immediately after displaying the native print window
> and won't be rejected if the window is closed without starting the print.

```typescript
printAsync(options: PrintOptions): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PrintOptions` | A map defining what should be printed. |

**Returns:** Resolves to an empty `Promise` if printing started.

#### printToFileAsync

Prints HTML to PDF file and saves it to [app's cache directory]().
On Web this method opens the print dialog.

```typescript
printToFileAsync(options: FilePrintOptions): Promise<FilePrintResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `FilePrintOptions` | A map of print options. |

#### selectPrinterAsync

Chooses a printer that can be later used in `printAsync`

**Platform:** ios

```typescript
selectPrinterAsync(): Promise<Printer>
```

**Returns:** A promise which fulfils with an object containing `name` and `url` of the selected printer.

### Interfaces

#### OrientationType

The possible values of orientation for the printed content.

| Property | Type | Description |
| --- | --- | --- |
| `landscape` | `string` | - |
| `portrait` | `string` | - |

### Types

#### FilePrintOptions

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `boolean` | Whether to include base64 encoded string of the file in the returned object. |
| `height` | `number` | Height of the single page in pixels. Defaults to `792` which is a height of US Letter paper format with 72 PPI. |
| `html` | `string` | HTML string to print into PDF file. |
| `margins` | `PageMargins` | Page margins for the printed document. |
| `textZoom` | `number` | The text zoom of the page in percent. The default is 100. |
| `useMarkupFormatter` | `boolean` | Alternative to default option that uses [UIMarkupTextPrintFormatter](https://developer.apple.com/documentation/uikit/uimarkuptextprintformatter) instead of WebView, but it doesn't display images. |
| `width` | `number` | Width of the single page in pixels. Defaults to `612` which is a width of US Letter paper format with 72 PPI. |

#### FilePrintResult

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `string` | Base64 encoded string containing the data of the PDF file. **Available only if `base64` option is truthy**. It doesn't include data URI prefix `data:application/pdf;base64,`. |
| `numberOfPages` | `number` | Number of pages that were needed to render given content. |
| `uri` | `string` | A URI to the printed PDF file. |

#### PageMargins


| Property | Type | Description |
| --- | --- | --- |
| `bottom` | `number` | - |
| `left` | `number` | - |
| `right` | `number` | - |
| `top` | `number` | - |

#### Printer

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Name of the printer. |
| `url` | `string` | URL of the printer. |

#### PrintOptions

| Property | Type | Description |
| --- | --- | --- |
| `height` | `number` | Height of the single page in pixels. Defaults to `792` which is a height of US Letter paper format with 72 PPI. **Available only with `html` option.** |
| `html` | `string` | HTML string to print. |
| `margins` | `PageMargins` | Page margins for the printed document. |
| `markupFormatterIOS` | `string` | - |
| `orientation` | `unknown | unknown` | The orientation of the printed content, `Print.Orientation.portrait` or `Print.Orientation.landscape`. |
| `printerUrl` | `string` | URL of the printer to use. Returned from `selectPrinterAsync`. |
| `uri` | `string` | URI of a PDF file to print. Remote, local (ex. selected via `DocumentPicker`) or base64 data URI starting with `data:application/pdf;base64,`. This only supports PDF, not other types of document (e.g. images). |
| `useMarkupFormatter` | `boolean` | Alternative to default option that uses [UIMarkupTextPrintFormatter](https://developer.apple.com/documentation/uikit/uimarkuptextprintformatter) instead of WebView, but it doesn't display images. |
| `width` | `number` | Width of the single page in pixels. Defaults to `612` which is a width of US Letter paper format with 72 PPI. **Available only with `html` option.** |
