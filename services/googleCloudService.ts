
// --- GOOGLE CLOUD SERVICE (SHEETS & DRIVE) ---

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];
const BACKUP_FILE_NAME = 'Bamboo_AI_Data_Backup';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Initialize GAPI (Google API Client)
export const initGapi = (apiKey: string) => {
    if (!apiKey) return;
    // @ts-ignore
    if (typeof gapi !== 'undefined') {
        // @ts-ignore
        gapi.load('client', async () => {
            try {
                // @ts-ignore
                await gapi.client.init({
                    apiKey: apiKey,
                    discoveryDocs: DISCOVERY_DOCS,
                });
                gapiInited = true;
                console.log("GAPI Initialized");
            } catch (error) {
                console.error("GAPI Init Error:", error);
            }
        });
    }
};

// Initialize GIS (Google Identity Services) - For Token
export const initGis = (onTokenReceived: (token: any) => void) => {
    // @ts-ignore
    if (typeof google !== 'undefined') {
        // @ts-ignore
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: localStorage.getItem('bamboo_google_client_id') || '',
            scope: SCOPES,
            callback: (resp: any) => {
                if (resp.error !== undefined) {
                    throw (resp);
                }
                onTokenReceived(resp);
            },
        });
        gisInited = true;
    }
};

// --- AUTHENTICATION ---
export const requestAccessToken = () => {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        alert("Google Identity Service chưa sẵn sàng. Hãy đảm bảo bạn đã nhập Client ID trong cài đặt.");
    }
};

// --- SHEETS OPERATIONS ---

// 1. Find or Create Backup Sheet
const findOrCreateSheet = async (): Promise<string> => {
    if (!gapiInited) {
        throw new Error("Google API chưa được khởi tạo. Vui lòng kiểm tra API Key.");
    }
    
    // Search for file
    // @ts-ignore
    const response = await gapi.client.drive.files.list({
        q: `name = '${BACKUP_FILE_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id, name)',
    });

    const files = response.result.files;
    if (files && files.length > 0) {
        return files[0].id; // Return existing ID
    } else {
        // Create new
        // @ts-ignore
        const createRes = await gapi.client.sheets.spreadsheets.create({
            properties: { title: BACKUP_FILE_NAME },
        });
        return createRes.result.spreadsheetId;
    }
};

// 2. Backup Data
export const backupToSheet = async () => {
    try {
        const spreadsheetId = await findOrCreateSheet();
        
        // Prepare Data: Convert LocalStorage to Array of Arrays
        const rows = [['KEY', 'VALUE (JSON)']]; // Header
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('bamboo_')) {
                const value = localStorage.getItem(key);
                rows.push([key, value || '']);
            }
        }

        // Clear existing data first
        // @ts-ignore
        await gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: 'Sheet1!A:B',
        });

        // Write new data
        // @ts-ignore
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'RAW',
            resource: { values: rows },
        });

        return { success: true, count: rows.length - 1, spreadsheetId };
    } catch (e) {
        console.error("Backup Error", e);
        throw e;
    }
};

// 3. Restore Data
export const restoreFromSheet = async () => {
    try {
        const spreadsheetId = await findOrCreateSheet();

        // Read data
        // @ts-ignore
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!A:B',
        });

        const rows = response.result.values;
        if (!rows || rows.length === 0) {
            return { success: false, message: "File backup trống." };
        }

        // Process Rows (Skip header)
        let count = 0;
        // Wipe existing bamboo data to be safe? Or Merge? Merge/Overwrite is safer.
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 2) {
                const key = row[0];
                const value = row[1];
                if (key && key.startsWith('bamboo_')) {
                    localStorage.setItem(key, value);
                    count++;
                }
            }
        }

        return { success: true, count };
    } catch (e) {
        console.error("Restore Error", e);
        throw e;
    }
};
