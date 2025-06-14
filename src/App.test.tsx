import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as download from "./download";

jest.mock("./download", ()=>({downloadCsv: jest.fn()}));
const mockedDownloadCsv = jest.mocked(download, true).downloadCsv;

const inputFileContents = `"Reservasjoner Fra: 01.05.2022 Til: 31.05.2022"
KORT,"KORT EID AV KUNDE","PRIS BOOKING",MEDLEM,KUNDEID,RESSURS,BESØKSDATO,STARTTID,BESTILLINGSDATO,BESTILLINGSTID,ANTALLRESURSER
<br/>,,"NOK 200,00",yes,4973596,"Dropin  - Sukkerbiten",01.05.2022,07:00-08:30,19.04.2022,"19.04.2022 12:04",2
"Årskort/månedskort   <br/>","Gyldig for angitt antall dager NOK 2 500,00    Gyldig for angitt antall dager NOK 2 800,00    Antall ganger     Antall ganger NOK 600,00    Antall ganger NOK 600,00    Antall ganger NOK 600,00    Rabatten er gyldig for et gitt antall dager NOK 200,00","NOK 0,00",yes,5502170,"Dropin  - Sukkerbiten",01.05.2022,07:00-08:30,28.04.2022,"28.04.2022 08:39",1
Gavekort<br/>,,"NOK 0,00",yes,2250679,"Dropin  - Sukkerbiten",01.05.2022,07:00-08:30,28.04.2022,"28.04.2022 19:18",1
`

const expectedOutputFileContents = `KORT,KORT EID AV KUNDE,PRIS BOOKING,MEDLEM,KUNDEID,RESSURS,BESØKSDATO,STARTTID,BESTILLINGSDATO,BESTILLINGSTID,ANTALLRESURSER\r
<br/>,,NOK 200,yes,4973596,Dropin  - Sukkerbiten,01.05.2022,07:00-08:30,19.04.2022,19.04.2022 12:04,2\r
Årskort/månedskort   <br/>,Gyldig for angitt antall dager NOK 2 500    Gyldig for angitt antall dager NOK 2 800    Antall ganger     Antall ganger NOK 600    Antall ganger NOK 600    Antall ganger NOK 600    Rabatten er gyldig for et gitt antall dager NOK 200,NOK 0,yes,5502170,Dropin  - Sukkerbiten,01.05.2022,07:00-08:30,28.04.2022,28.04.2022 08:39,1\r
Gavekort<br/>,,NOK 0,yes,2250679,Dropin  - Sukkerbiten,01.05.2022,07:00-08:30,28.04.2022,28.04.2022 19:18,1`


test('renders learn react link', async () => {
  const file = new File(inputFileContents.split("\n").map(line => line + "\n"), 'input.csv', {type: 'text/csv'});


  render(<App/>);

  const importFileRegion = screen.getByTestId("region-Importer fil");

  const fileChooser = within(importFileRegion).getByTestId("input-file-chooser");
  userEvent.upload(fileChooser, file);

  await waitFor(() => {
    expect(within(screen.getByTestId("region-Importer fil")).getByRole("textbox")).toHaveTextContent(/.+/);
  })

  await waitFor(() => {
    expect(within(screen.getByTestId("region-resultat-csv")).getByRole("textbox")).toHaveTextContent(/.+/);

  })

  const downloadButton = screen.getByRole("button", {name: "Last ned resultat-CSV"});
  fireEvent.click(downloadButton);

  await waitFor(() => {
    expect(mockedDownloadCsv).toHaveBeenCalledWith(expectedOutputFileContents);
  })


});
