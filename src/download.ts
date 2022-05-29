import streamSaver from "streamsaver";

const downloadCsv = (csv: string) => {
    const encoded = new TextEncoder().encode(csv);

    const fileStream = streamSaver.createWriteStream("output.json", {
        size: encoded.byteLength,
        writableStrategy: undefined,
        readableStrategy: undefined,
    });
    const writer = fileStream.getWriter();
    writer.write(encoded);
    writer.close();
};

export {downloadCsv}
