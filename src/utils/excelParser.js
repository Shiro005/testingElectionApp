// src/utils/excelParser.js
import * as XLSX from "xlsx";

export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const normalizedData = jsonData.map((row, index) => ({
          id:
            row.voterId?.toString().trim() ||
            row["Voter ID"]?.toString().trim() ||
            `${index + 1}`,
          serialNumber:
            row.serialNumber ||
            row["Serial Number"] ||
            row["Sr No"] ||
            index + 1,
          name: row.name || row.Name || "",
          voterId:
            row.voterId?.toString().trim() ||
            row["Voter ID"]?.toString().trim() ||
            "",
          age: row.age || row["Age"] || "",
          gender: row.gender || row["Gender"] || "",
          boothNumber:
            row.boothNumber || row["Booth Number"] || row.booth || "",
          prabhag:
            row.prabhag || row["Prabhag No"] || row.prabhag || "",
          pollingStationAddress:
            row.pollingStationAddress ||
            row["Polling Station Address"] ||
            row["Address"] ||
            "",
          yadiBhagAddress:
            row.yadiBhagAddress ||
            row["Yadi Bhag / Address"] ||
            row["Yadi Bhag / Address"] ||
            "",
          lastUpdated: Date.now(),
        }));

        // Save static data into public/voter.json
        const jsonBlob = new Blob([JSON.stringify(normalizedData, null, 2)], {
          type: "application/json",
        });
        const downloadUrl = URL.createObjectURL(jsonBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "voter.json";
        a.click();
        URL.revokeObjectURL(downloadUrl);

        resolve(normalizedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
