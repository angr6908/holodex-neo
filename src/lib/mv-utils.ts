export type LayoutItem = { i: string; x: number; y: number; w: number; h: number; [key: string]: any };

export interface Content {
    id?: string;
    type: string;
    isTwitch?: boolean;
    video?: any;
    currentTab?: number;
    currentTime?: number;
    editMode?: boolean;
    muted?: boolean;
    volume?: number;
    playbackRate?: number;
    initAsTL?: boolean;
}

const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.";
export const sortLayout = (a, b) => a.x - b.x || a.y - b.y;

export const generateContentId = () => Array.from({ length: 8 })
    .map(() => b64[Math.floor(Math.random() * b64.length)])
    .join("");

/**
 * Encodes a layout array and contents to a compact URI
 * @param {{layout, contents, includeVideo?}} layout and layout contents
 * @returns {string} encoded string
 */
export function encodeLayout({ layout, contents, includeVideo = false }) {
    const l: string[] = [];
    try {
        layout.forEach((item) => {
            let encodedBlock = "";
            let invalid = false;
            ["x", "y", "w", "h"].forEach((key) => {
                if (item[key] >= 64) {
                    invalid = true;
                } else {
                    encodedBlock += b64[item[key]];
                }
            });

            if (invalid) return;

            if (contents[item.i]) {
                const {
                    id, type, video, currentTab,
                } = contents[item.i];
                if (type === "chat") {
                    encodedBlock += `chat${currentTab || 0}`;
                } else if (type === "video" && includeVideo) {
                    if (video?.type === "twitch") {
                        encodedBlock += `twitch${id}`;
                    } else {
                        encodedBlock += id;
                    }
                }
            }
            l.push(encodedBlock);
        });
        return l.join(",");
    } catch (e) {
        console.error(e);
        return "error";
    }
}

/**
 * Decodes a string to layout array and contents
 * @param {string} encodedStr encoded string
 * @returns {{layout, content}} layout and layout contents as array and object
 */
export function decodeLayout(encodedStr) {
    const parsedLayout: LayoutItem[] = [];
    const parsedContent: Record<number, Content> = {};
    let videoCellCount = 0;
    const parts = encodedStr.split(",");
    parts.sort(); // DO NOT TOUCH THIS LINE
    parts.forEach((str) => {
        const index = generateContentId();
        const xywh = str.substring(0, 4);
        const idOrChat = str.substring(4, 15);
        const isChat = idOrChat.substring(0, 4) === "chat";
        const isTwitch = idOrChat.substring(0, 6) === "twitch";
        const channelName = str.substring(15);

        const keys = ["x", "y", "w", "h"];
        const layoutItem: LayoutItem = {
            w: 0,
            h: 0,
            x: 0,
            y: 0,
            i: index,
            isDraggable: true,
            isResizable: true,
            moved: false,
        };

        xywh.split("").forEach((char, keyIndex) => {
            const num = b64.indexOf(char);
            layoutItem[keys[keyIndex]] = num;
        });
        videoCellCount += 1;
        if (isChat) {
            const currentTab = idOrChat.length === 5 ? Number(idOrChat[4]) : -1;
            parsedContent[index] = {
                type: "chat",
                ...(currentTab >= 0) && { currentTab },
            };
            videoCellCount -= 1;
        } else if (isTwitch) {
            const twitchChannel = str.substring(10);
            parsedContent[index] = {
                type: "video",
                id: twitchChannel,
                video: {
                    id: twitchChannel,
                    type: "twitch",
                    channel: {
                        name: twitchChannel,
                    },
                },
            };
        } else if (idOrChat.length === 11) {
            parsedContent[index] = {
                type: "video",
                id: idOrChat,
                video: {
                    id: idOrChat,
                    channel: {
                        name: channelName || idOrChat,
                    },
                },
            };
        }
        parsedLayout.push(layoutItem);
    });
    return {
        id: encodedStr,
        layout: parsedLayout,
        content: parsedContent,
        videoCellCount,
    };
}

export const desktopPresets = Object.freeze([
    { layout: "AAYY", name: "1🎞️" },
    { layout: "AATY,TAFYchat0", name: "Side Chat 1", default: 1 },
    { layout: "AAMY,MAMY", name: "2🎞️", default: 2 },
    { layout: "AARM,AMRM,RAHYchat", name: "Side Chat 2" },
    { layout: "AAOM,AMOM,OAFYchat,TAFYchat", name: "2🎞️, 2💬" },
    { layout: "AAMY,MAMM,MMMM", name: "1🎞️+2", default: 3 },
    { layout: "AAMM,AMMM,MAMM,MMGMchat,SMGMchat", name: "3🎞️, 2💬" },
    { layout: "AAMM,AMMM,MAMM,MMMM", name: "2x2🎞️" },
    { layout: "AAKM,KAKM,UAEMchat0,AMKM,KMKM,UMEMchat0", name: "2x2🎞️ 2💬", default: 4 },
    { layout: "PAJM,AAJM,AMJM,PMJM,JADMchat0,JMDMchat0,MADMchat0,MMDMchat0", name: "2x2🎞️ 4💬" },
    { layout: "SAGYchat,AAJM,AMJM,JAJM,JMJM", name: "2x2🎞️ 1💬" },
    { layout: "AAMP,APIJ,IPIJ,MAMP,QPIJ", name: "5🎞️", default: 5 },
    { layout: "AAIM,AMIM,IAIM,QMIM,QAIM,MMEMchat0,IMEMchat0", name: "5🎞️ 2💬", default: 5 },
    { layout: "AAIM,AMIM,IAIM,IMIM,QAIM,QMIM", name: "2x3🎞️", default: 6 },
    { layout: "AAQQ,AQII,IQII,QAII,QIII,QQII", name: "p1s5" },
    { layout: "AAJM,AMJM,JAJM,JMJM,SAGI,SIGI,SQGI", name: "7🎞️", default: 7 },
    { layout: "AAKM,AMKM,RAHI,KAHI,RQHI,KQHI,KIHI,RIHI", name: "8🎞️", default: 8 },
    { layout: "AAII,AIII,AQII,IAII,IIII,IQII,QAII,QIII,QQII", name: "3 x 3🎞️", default: 9 },
    { layout: "AAGI,GAGI,MAGI,AIGI,GIGI,MIGI,AQGI,GQGI,MQGI,SAGYchat", name: "3x3🎞️ 1💬" },
    { layout: "AAHI,AQHI,AIHI,HAHI,HIHI,HQHI,OAHI,OIHI,OQHI,VIDIchat0,VADIchat0,VQDIchat0", name: "3x3🎞️ 3💬" },
    { layout: "AAML,MAML,ALGH,GLGH,MLGH,SLGH,ASGG,GSGG,MSGG,SSGG", name: "Among Us 1", default: 10 },
    { layout: "AAKL,KAKL,UAEYchat,ALFH,FLFH,KLFH,PLFH,ASFG,FSFG,KSFG,PSFG", name: "Among Us 2" },
    { layout: "AASR,SAGYchat,ARGH,GRGH,MRGH", name: "Sports Fes 1" },
    { layout: "AAMM,SAGYchat,AMGG,ASGG,GMGG,GSGG,MAGG,MGGG,MMGG,MSGG", name: "Sports Fes 2" },
    { layout: "GAMM,GMMM,AAGG,AGGG,AMGG,ASGG,SAGG,SGGG,SMGG,SSGG", name: "Sports Fes 3" },
    { layout: "AAIK,IAIK,QAIK,AKGH,GKGH,MKGH,SKGH,SRGH,ARGH,MRGH,GRGH", name: "Among Us 3", default: 11 },
    { layout: "AAGI,GAGI,MAGI,AIGI,GIGI,MIGI,SIGI,SQGI,AQGI,MQGI,GQGI,SAGI", name: "4x3", default: 12 },
    { layout: "AAMM,MMGG,AMGG,GMGG,MGGG,SSGG,MSGG,MAGG,SMGG,SGGG,SAGG,ASGG,GSGG", name: "13🎞️", default: 13 },
    { layout: "AMJM,OMFG,OGFG,TGFG,JMFG,AAJM,OAFG,TMFG,JAFG,TSFG,OSFG,JGFG,TAFG,JSFG", name: "14🎞️", default: 14 },
    { layout: "AGGG,MMGG,MGGG,SGGG,GMGG,AAGG,MAGG,SMGG,GAGG,SSGG,MSGG,GGGG,SAGG,GSGG,AMGG,ASGG", name: "4x4", default: 16 },
    { layout: "AAHY,HAHY,OAFYchat,TAFYchat", name: "2📱 2💬" },
    { layout: "AAGY,GAGY,MAGY,SAGYchat", name: "3📱 1💬" },
    { layout: "AAMM,AMMM,MAHY,TAFYchat2", name: "2🎞️ 1📱 1💬" },
]);

export const mobilePresets = Object.freeze([
    {
        layout: "AAYI,AIYQchat0",
        name: "Mobile 1",
        emptyCells: 1,
        portrait: true,
    },
    {
        layout: "AOYKchat,AAYH,AHYH",
        name: "Mobile 2",
        emptyCells: 2,
        portrait: true,
    },
    {
        layout: "AAYI,AIYI,AQYI",
        name: "Mobile 3",
        emptyCells: 3,
        portrait: true,
    },
    { layout: "MAMY,AAMM,AMMM", name: "Mobile 3L" },
    { layout: "AAMM,AMMM,MAMM,MMMM", name: "Mobile 4", emptyCells: 4 },
]);

export function getDesktopDefaults() {
    const autoLayoutDefaults = [];
    desktopPresets.forEach((preset) => {
        if (preset.default) autoLayoutDefaults[preset.default] = preset.layout;
    });
    return autoLayoutDefaults;
}

export const reorderIcon = "M2 2h8.8v8.8H2V2Zm11.3 11.3H22V22h-8.8v-8.8Zm4.6-10.9a.6.6 0 0 0-1 0l-3.9 4a.6.6 0 1 0 .9.9l3.5-3.6L21 7.3a.6.6 0 0 0 .8-1l-4-4Zm.1 10V2.8h-1.2v9.6H18ZM5.7 21.6c.3.3.7.3 1 0l3.9-4a.6.6 0 1 0-.9-.9l-3.5 3.6-3.6-3.6a.6.6 0 1 0-.9 1l4 4Zm-.2-10v9.6h1.3v-9.6H5.5Z";
