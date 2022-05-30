import React, { ChangeEvent, MouseEventHandler, useEffect, useMemo, useState } from 'react';
import './App.css';
import Papa, { ParseError, ParseResult, ParseStepResult } from 'papaparse';
// @ts-ignore
import replaceAllInserter from 'string.prototype.replaceall';
import { downloadCsv } from "./download";

replaceAllInserter.shim();

type PreviewProps = {
  value: string,
  setValue?: (value: string) => void
}
const RawPreview = (props: PreviewProps) => {

  const changeHandler = props.setValue && ((event: ChangeEvent<HTMLTextAreaElement>) => props.setValue!(event.target.value));
  return <textarea className={"step-result-view"} rows={20} cols={60} value={props.value} readOnly={!props.setValue} disabled={!props.setValue} onChange={changeHandler}/>
}

type Dictionary = { [index: string]: any };
type NumberedDictionary = {row: number} & Dictionary;
type AnnotatedDictionary = NumberedDictionary & {error?: ParseError[]}

const SpreadsheetPreview = (props: SpreadsheetData & ProgressType) => {


  return <div className={"spreadsheet-wrapper"}>
    {props.complete ?
      <table>
        <thead>
        <tr>
          <th>Rad nr</th>
          {props.fields?.map(field => <th key={field}>{field}</th>)}
        </tr>
        </thead>
        <tbody>
        {props.data.map((rowData: AnnotatedDictionary, idx: number) => {
          const onRowClick : MouseEventHandler | undefined = props.rowAttributes?.onClick && (() => {
            console.log("Klikker på ", rowData);
            props.rowAttributes?.onClick(rowData);
          })
          const rowNumberAttribute = {["data-"+props.rowIdPrefix+"-rownumber"]: rowData.row};
          return <tr key={idx} id={(props.rowIdPrefix || "") + rowData.row} {...rowNumberAttribute} className={rowData.error && "highlighted-error"} data-error={JSON.stringify(rowData.error)}>
            <td className={"row-number"}>{rowData.row}</td>
            {props.fields?.map(field => {
              const colValue = rowData.hasOwnProperty(field) && rowData[field];
              return <td key={field} onClick={onRowClick}>{colValue}</td>;
            })}
          </tr>;
        })
        }
        </tbody>
      </table> : <div>Vennligst vent ...</div>}
  </div>

}

type Transformer = ((input: string) => string);

type SpreadsheetData = {
  data: Array<AnnotatedDictionary>,
  fields: Array<string>,
  rowIdPrefix?: string,
  rowAttributes?: { onClick: (rowData: Dictionary) => void}
}

type ProgressType = { complete: boolean, rowsProcessed: number };
type ParseResultWithProgress =
  ParseResult<AnnotatedDictionary>
  & ProgressType & { unparsed?: string };

function App() {

  const [inputCsv, setInputCsv] = useState<string>("");

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
      });
      fileReader.onerror = (error => {
        return reject(error);
      })
    })
  }

  const removeHeader = (input: string) => {
    const lines = input.split("\n");
    const [, ...rowsWithoutHeader] = lines;
    return rowsWithoutHeader.join("\n");
  }

  const removeDecimals = (input: string) => {
    const lines = input.split("\n");
    return lines.map(line => line.replaceAll(",00", "")).join("\n");
  }

  const replaceAmounts = (input: string) => {
    const lines = input.split("\n");
    return lines.map(line => line.replaceAll("112,50", "112").replaceAll("262,50", "262")).join("\n");
  }


  const [parseResult, setParseResult] = useState<ParseResultWithProgress>({data: [],
    meta: {
      delimiter: ",",
      fields: [],
      aborted: false,
      cursor: 0,
      linebreak: "\n",
      truncated: false
    },
    errors: [],
    rowsProcessed: 0,
    complete: true
  });

  const unparse = (parseResult: ParseResult<Dictionary>) => {
    return Papa.unparse(parseResult.data.map(dataRow => {
      const {error, row, ...realData} = dataRow;
      return realData;
    }), {delimiter: ",", header: true, quotes: false, newline: "\r\n"});
  }

  const operationDefinitions : Array<{
    id: string,
    title: string,
    func: Transformer
  }> = useMemo(() => {

    return [
      {
        id: "remove-first-line",
        title: "Fjern første linje",
        func: removeHeader,
      }, {
        id: "fjern-alle-00-step",
        title: "Fjern alle ,00",
        func: removeDecimals,
      }, {
        id: "endre-desimaler-step",
        title: "Endre 112,50 til 112 og 262,50 til 262",
        func: replaceAmounts,
      }
    ];
  }, []);

  const [operationSelections, setOperationSelections] = useState<Array<{ id: string, selected: boolean }>>(operationDefinitions.map(op => ({id: op.id, selected: true})));

  const selectOperation = (operationId: string, selected: boolean) => {
    console.log("Selecting operation " + operationId + " " + selected)
    operationSelections.forEach(operation => {
      if (operation.id === operationId) {
        operation.selected = selected;
      }});
    console.log('operationSelections = ', operationSelections);
    setOperationSelections([...operationSelections]);
  }


  const [preParsed, setPreParsed] = useState<string>("");

  useEffect(() => {
    window.setTimeout(() => {
      console.log("Filtrerer linjer");
      const selectedOperationIds = operationSelections.filter(operationSelection => operationSelection.selected).map(operationSelection => operationSelection.id);

      const operationsToPerform = operationDefinitions.filter(operationDefinition => selectedOperationIds.includes(operationDefinition.id)).map(operationDefinitions => operationDefinitions.func);

      let result = inputCsv;
      for (const operation of operationsToPerform) {
        result = operation(result);
      }

      setPreParsed(_ => result);
      console.log("Ferdig med å filtrere linjer");
    })
  }, [inputCsv, operationDefinitions, operationSelections])

  useEffect(() => {
    const parseCsv = (csv: string) => {
      let tempParseResult : ParseResultWithProgress = {
          errors: [],
          meta: {
            delimiter: "",
            fields: [],
            aborted: false,
            cursor: 0,
            truncated: false,
            linebreak: ""
          },
          data: [],
          complete: false,
          rowsProcessed: 0,
        }
      ;
      setParseResult(tempParseResult);
      window.setTimeout(() => {
        Papa.parse<Dictionary>(csv, {
          header: true,
          delimiter: ",",
          complete(_: ParseResult<Dictionary>) {
            console.log("Complete");
            // window.setTimeout(() => {
            setParseResult(({...tempParseResult, complete: true, unparsed: unparse(tempParseResult)}));
            // })
          },
          // worker: true,
          step: (stepResult: ParseStepResult<Dictionary>) => {
            const updatedParseResult = {...tempParseResult};
            if (updatedParseResult.data.length === 0) {
              updatedParseResult.meta = stepResult.meta
            }
            if (stepResult.errors.length > 0) {
              updatedParseResult.errors.push(...stepResult.errors);
            }
            updatedParseResult.data.push({...stepResult.data, row: updatedParseResult.data.length, error: stepResult.errors.length > 0 ? stepResult.errors : undefined});
            updatedParseResult.rowsProcessed += 1;
            tempParseResult = updatedParseResult;
            /*
                    setParseResult(oldResult => {
                      return ({
                        meta: stepResult.meta,
                        errors: [...oldResult.errors, ...stepResult.errors],
                        data: [...oldResult.data, stepResult.data],
                        complete: false,
                        rowsProcessed: oldResult.data.length + 1
                      });
                    });
            */
          }
        });
      })
    }
    parseCsv(preParsed);
  }, [preParsed])

  let lipsumRows = [];
  for (let i = 0; i < 300; i++) {
    lipsumRows.push(<div key={i}>{i}: sei, torsk, hyse, gjedde</div>);
  }


  const highlightOffendingRow = (rowNum: number) => {
    document.querySelectorAll(".selected-error").forEach(row => row.classList.remove("selected-error"));
    const trs = document.querySelectorAll<HTMLElement>(`*[data-data-rownumber='${rowNum}'].highlighted-error, *[data-error-rownumber='${rowNum}']`)!;
    trs.forEach(tr => tr.classList.add("selected-error"));
    trs.forEach(tr => tr.scrollIntoView({block: "center", behavior: "auto"}));
  }

  return (
    <div className="App">
      <fieldset data-testid={"region-Importer fil"} className={"region-import"}>
        <legend>Input-fil</legend>
        <input type={"file"} name={"inputFile"} data-testid={"input-file-chooser"} accept={"text/csv-schema,.csv"}
               onChange={() => {
                 console.log("Valgt fil");
                 return doImport().then(result => setInputCsv(result));
               }}
               onClick={(event: React.MouseEvent<HTMLInputElement>) => {
                 event.currentTarget.value = "";
                 setInputCsv("");
               }}
        />
        <br/><br/>
        <RawPreview value={inputCsv}/>
      </fieldset>
      <fieldset data-testid={"region-Operasjoner"}>
        <legend>Operasjoner</legend>
        <div className={"checkbox-set"}>
          {
            operationDefinitions.map(op => {
              return {...op, selected: operationSelections.find(os => os.id === op.id)!.selected};
            }).map(op => <label key={op.id} className={"operation-selector-label"} htmlFor={op.id}>
              <input id={op.id} type={"checkbox"} name={`checkbox-${op.title}`} checked={op.selected} onChange={event => selectOperation(op.id, event.target.checked)}/> {op.title}
            </label>)
          }
        </div>
        <br/>
      </fieldset>
      <fieldset className={"flex-grows"}>
        <legend>Forhåndsvisning</legend>
        <SpreadsheetPreview
          fields={parseResult.meta.fields || []}
          data={parseResult.data}
          complete={parseResult.complete}
          rowsProcessed={parseResult.rowsProcessed}
          rowIdPrefix={"data"}
          rowAttributes={{onClick: (rowData: Dictionary) => highlightOffendingRow(rowData["row"])}}
        />
      </fieldset>

      <fieldset className={"flex-grows"} data-testid={"region-resultat-csv"}>
        <legend>Resultat-CSV</legend>
        {parseResult.unparsed && <RawPreview value={parseResult.unparsed}/>}
      </fieldset>

      {parseResult.errors.length > 0 && <fieldset className={"flex-grows"}>
        <legend>Feil</legend>
        <SpreadsheetPreview
          data={parseResult.errors}
          fields={["type", "code", "message", "row"]}
          complete={parseResult.complete}
          rowsProcessed={parseResult.rowsProcessed}
          rowAttributes={{onClick: (rowData: Dictionary) => highlightOffendingRow(rowData["row"])}}
          rowIdPrefix={"error"}
        />
      </fieldset>}

      <fieldset className={"region-download"}>
        <button type={"button"} disabled={!parseResult.complete || parseResult.data.length === 0} onClick={() => downloadCsv(parseResult.unparsed!)} title={"Last ned resultat-CSV"}>Last ned resultat-CSV</button>
        {parseResult.data.length > 0 && (<><div>{parseResult.data.length} rader</div> <div>{parseResult.meta.fields?.length} kolonner</div> <div>{parseResult.errors.length} feil</div></>)}
      </fieldset>
    </div>
  );
}

export default App;
