import React, { MouseEventHandler, useEffect, useState } from 'react';
import './App.css';
import Papa, { ParseResult } from 'papaparse';
import streamSaver from 'streamsaver';
// @ts-ignore
import replaceAllInserter from 'string.prototype.replaceall';

replaceAllInserter.shim();

type PreviewProps = {
  value: string,
  onChange: (value: string) => void
}
const InputPreview = (props: PreviewProps) => {

  return <div>CSV:<br/>
    <textarea className={"step-result-view"} rows={20} cols={60} value={props.value} readOnly={true}
    />;
  </div>
}

type Dictionary = { [index: string]: any };

const SpreadsheetPreview = (props: { input: ParseResult<Dictionary> }) => {

  const parseResult = (props.input);

  if (parseResult.errors.length > 0) {
    return <div>
      {parseResult.errors.map((error, idx) => <div key={idx}>{JSON.stringify(error)}</div>)}
    </div>
  }
  return <div className={"spreadsheet-wrapper"}>
    <table>
      <thead>
      <tr>
        {parseResult.meta.fields?.map(field => <th key={field}>{field}</th>)}
      </tr>
      </thead>
      <tbody>
      {parseResult.data.map((row: Dictionary, idx: number) => <tr key={idx}>
        {parseResult.meta.fields?.map(field => {
          const colValue = row.hasOwnProperty(field) && row[field];
          return <td key={field}>{colValue}</td>;
        })}
      </tr>)
      }
      </tbody>
    </table>
  </div>

}

type StepProps<Input extends object | string | void, Output> = {
  input: Input;
  title: string;
  func: (input: Input) => Output | Promise<Output>;
  setResult: (result: Output) => void;
  renderer?: (input: Input) => React.ReactNode
}

function Step<Input extends object | string | void, Output>(props: StepProps<Input, Output>) {

  const clickHandler: MouseEventHandler = () => {
    const result: Promise<Output> | Output = props.func((props.input)!);
    // setValue(result);
    if (result instanceof Promise) {
      result.then(resolved => props.setResult(resolved))
    } else {
      props.setResult(result);
    }
  }

  const renderer: (input: Input) => React.ReactNode = props.renderer || ((input: Input) =>
    <div><InputPreview value={input && input.toString()} onChange={() => undefined}/></div>)

  return (<fieldset data-testid={`region-${props.title}`}>
    {renderer(props.input)}
    <button type={"button"} onClick={clickHandler}>{props.title}</button>
  </fieldset>);
}


function App() {


  const [input1, setInput1] = useState<string>("");

  const doImport: () => Promise<string> = () => {
    return new Promise<string>((resolve, reject) => {
      const inputFileElement: HTMLInputElement = document.getElementsByName("inputFile")[0] as HTMLInputElement;
      let file = inputFileElement.files![0];
      console.log("Du valgte fila ", file);
      const fileReader = new FileReader();
      fileReader.readAsText(file, "utf-8");
      fileReader.onload = (() => {
        console.log("Ferdig med å lese input-fil")
        const text: string = fileReader.result as string;
        return resolve(text.trim());
        // setInput1(text.trim());
      });
      fileReader.onerror = (error => {
        return reject(error);
      })
    })
  }

  const [input2, setInput2] = useState<string>("");

  const removeHeader = (input: string) => {
    const lines = input.split("\n");
    const [, ...rowsWithoutHeader] = lines;
    return rowsWithoutHeader.join("\n");
  }

  const [input3, setInput3] = useState<string>("");

  const removeDecimals = (input: string) => {
    const lines = input.split("\n");
    return lines.map(line => line.replaceAll(",00", "")).join("\n");
  }

  const [input4, setInput4] = useState<string>("");

  const replaceAmounts = (input: string) => {
    const lines = input.split("\n");
    return lines.map(line => line.replaceAll("112,50", "112").replaceAll("262,50", "262")).join("\n");
  }


  const [parseResult, setParseResult] = useState<ParseResult<Dictionary>>({data: [],
    meta: {
      delimiter: ",",
      fields: [],
      aborted: false,
      cursor: 0,
      linebreak: "\n",
      truncated: false
    },
    errors: []
  });
  const parseCsv = (csv: string) => Papa.parse<Dictionary>(csv, {header: true, delimiter: ","})

  const [unparsed, setUnparsed] = useState<string>("");

  const unparse = (parseResult: ParseResult<Dictionary>) => {
    return Papa.unparse(parseResult.data, {delimiter: ";", header: true, quotes: false});
  }

  useEffect(() => {
    const parseResult = parseCsv(input4 || input3 || input2);
    setParseResult(parseResult);
  }, [input2, input3, input4])

  const steps = [
    <Step<void, string> key={"importer-fil-step"} input={undefined} title={"Importer fil"} func={doImport}
                                             setResult={setInput1} renderer={() =>
    <input type={"file"} name={"inputFile"} data-testid={"input-file-chooser"} accept={"text/csv-schema,.csv"}/>}
  />,

    <Step<string, string> key="fjern-første-linje-step" input={input1} title={"Fjern første linje"} func={removeHeader}
                          setResult={setInput2}/>,
    <Step<string, string> key={"fjern-alle-00-step"} input={input2} title={"Fjern alle ,00"} func={removeDecimals}
                          setResult={setInput3}/>,
    <Step<string, string> key={"endre-desimaler-step"} input={input3} title={"Endre 112,50 til 112 og 262,50 til 262"}
                          func={replaceAmounts} setResult={setInput4}/>
  ];

  return (
    <div className="App">
      <form>
        {steps}
      </form>
      <div className={"preview-wrapper"}>
        <Step<ParseResult<Dictionary>, string>
          title={"Forhåndsvis CSV-fil"}
          setResult={setUnparsed}
          input={parseResult}
          func={unparse}
          renderer={(parseResult: ParseResult<Dictionary>) => <SpreadsheetPreview input={parseResult}/>}
        />
        <Step<string, void> input={unparsed} title={"Last ned behandlet CSV-fil"}
                            func={(contents) => {
                              const encoded = new TextEncoder().encode(contents);

                              const fileStream = streamSaver.createWriteStream("output.json", {
                                size: encoded.byteLength,
                                writableStrategy: undefined,
                                readableStrategy: undefined
                              });
                              const writer = fileStream.getWriter();
                              writer.write(encoded);
                              writer.close();
                            }} setResult={() => undefined}/>
      </div>

    </div>
  );
}

export default App;
