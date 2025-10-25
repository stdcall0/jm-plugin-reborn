import PLUGIN_ID from '#gc.id';
import { Plugin, Logger, Config, Path, Common } from '#gc';
import { exec } from 'child_process';
export class JMComicPlugin extends Plugin {
    constructor() {
        super({
            name: 'jm 查询插件',
            dsc: '查询 jm 神秘数字对应的漫画信息',
            event: 'message',
            priority: '98',
            rule: [
                {
                    reg: '^(jm|JM)\\d{3,10}$',
                    fnc: 'jmQuery'
                }
            ]
        });
    }
    async respond(data) {
        var _a, _b, _c, _d, _e;
        const fields_raw = ((_a = Config.get('jmcomic')) === null || _a === void 0 ? void 0 : _a.get('fields')) || [];
        const fields_description_raw = ((_b = Config.get('jmcomic')) === null || _b === void 0 ? void 0 : _b.get('fields_description')) || {};
        // Filter valid fields only,
        // and build fields_description: remove invalid keys and add missing defaults
        const fields = fields_raw.filter((field) => JMComicPlugin.VALID_FIELDS.includes(field));
        const fields_description = {};
        for (const field of JMComicPlugin.VALID_FIELDS) {
            if (fields_description_raw.hasOwnProperty(field) && typeof fields_description_raw[field] === 'string') {
                fields_description[field] = fields_description_raw[field];
            }
            else {
                fields_description[field] = JMComicPlugin.DEFAULT_DESCRIPTIONS[field];
            }
        }
        const compact_fields = ((_c = Config.get('jmcomic')) === null || _c === void 0 ? void 0 : _c.get('compact_fields')) || false;
        const forward_msg = compact_fields || (((_d = Config.get('jmcomic')) === null || _d === void 0 ? void 0 : _d.get('forward_msg')) || true);
        const send_cover = ((_e = Config.get('jmcomic')) === null || _e === void 0 ? void 0 : _e.get('send_cover')) || true;
        if (fields.length === 0 && !send_cover) {
            await this.e.reply('未配置任何要查询的字段，且封面发送已禁用。请检查插件配置。', true);
            return;
        }
        let field_msgs = [];
        let forward_msgs = [];
        if (fields.length > 0) {
            for (const field of fields) {
                let value = data[field];
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                field_msgs.push(`${fields_description[field]}: ${value}`);
            }
            if (compact_fields)
                field_msgs = [field_msgs.join('\n')];
            if (forward_msg)
                forward_msgs = forward_msgs.concat(field_msgs);
            else {
                for (const msg of field_msgs) {
                    await this.e.reply(msg);
                }
            }
        }
        if (send_cover) {
            const cover_base64 = data['cover_base64'];
            const cover_img = cover_base64 ? Buffer.from(cover_base64, 'base64') : null;
            if (!cover_img) {
                Logger.error(`[${PLUGIN_ID}] Failed to download cover image: ${data.id}\n${data.cover_err}`);
                if (forward_msg)
                    forward_msgs.push('封面下载失败...');
                else
                    await this.e.reply('封面下载失败...');
            }
            else {
                if (forward_msg)
                    forward_msgs.push(segment.image(cover_img.toString('binary')));
                else
                    await this.e.reply(segment.image(cover_img.toString('binary')));
            }
        }
        if (forward_msg) {
            const msg = await Common.makeForwardMsg(this.e, forward_msgs);
            await this.e.reply(msg);
        }
    }
    checkTrigger() {
        var _a, _b, _c, _d;
        const enabled_groups = ((_a = Config.get('jmcomic')) === null || _a === void 0 ? void 0 : _a.get('trigger.enabled_groups')) || [];
        const disabled_groups = ((_b = Config.get('jmcomic')) === null || _b === void 0 ? void 0 : _b.get('trigger.disabled_groups')) || [];
        const enable_pm = ((_c = Config.get('jmcomic')) === null || _c === void 0 ? void 0 : _c.get('trigger.enable_pm')) || false;
        if (enabled_groups.length === 0 && disabled_groups.length === 0) {
            // If both enabled_groups and disabled_groups are empty, the plugin is enabled for all groups
            return true;
        }
        const group_id = (_d = this.e) === null || _d === void 0 ? void 0 : _d.group_id;
        if (!group_id) {
            // If there is no group_id (private message), check enable_pm
            return enable_pm;
        }
        if (enabled_groups.includes(group_id)) {
            // If the group is in the enabled_groups, the plugin is enabled
            return true;
        }
        // If enabled_groups is empty, the plugin is enabled for all groups not in disabled_groups
        return !disabled_groups.includes(group_id) && enabled_groups.length === 0;
    }
    async jmQuery() {
        var _a, _b;
        const jmID = this.e.msg.toLowerCase();
        // We must verify that jmID is in the correct format
        // The correct format is "jm" followed by digits only
        // Otherwise attacker may exploit command injection vulnerability
        // However it is already assumed because rule regex is used
        if (!jmID.startsWith("jm"))
            return;
        const blacklistedIds = ((_a = Config.get('jmcomic')) === null || _a === void 0 ? void 0 : _a.get('jm_blacklist')) || [];
        if (blacklistedIds.includes(jmID)) {
            Logger.info(`[${PLUGIN_ID}] Query for blacklisted ID ${jmID} blocked.`);
            return;
        }
        // Check if the plugin is enabled for this context
        if (!this.checkTrigger())
            return;
        // Determine python executable path
        const pythonExec = ((_b = Config.get('python')) === null || _b === void 0 ? void 0 : _b.get('python')) || 'python3';
        // Determine jm.py path
        const jmPyPath = Path.join(Path.App, 'jm.py');
        exec(`${pythonExec} ${jmPyPath} ${jmID}`, { windowsHide: true }, async (error, stdout, stderr) => {
            if (error) {
                Logger.error(`[${PLUGIN_ID}] Fatal error when executing python script:\n${pythonExec} ${jmPyPath} ${jmID}\n${error}`);
                await this.e.reply(`查询出错了...`, true);
            }
            else {
                const lines = stdout.split('\n');
                let line_idx = 0;
                for (let i = lines.length - 1; i >= 1; --i)
                    if (lines[i].trim()) {
                        line_idx = i;
                        break;
                    }
                const json_str = lines[line_idx];
                const logs = lines.slice(0, line_idx).join('\n');
                try {
                    const res = JSON.parse(json_str);
                    if (!res.success) {
                        Logger.warn(`[${PLUGIN_ID}] Query failed for ID ${jmID}:\nError msg:\n${res.msg}\nLogs:\n${logs}`);
                        await this.e.reply(`查询出错了...`, true);
                    }
                    else {
                        this.respond(res.data);
                    }
                }
                catch (e) {
                    Logger.error(`[${PLUGIN_ID}] Failed to parse JSON response: ${json_str}\nLogs:\n${logs}`);
                    await this.e.reply(`查询出错了...`, true);
                }
            }
        });
    }
}
JMComicPlugin.VALID_FIELDS = [
    'id', 'name', 'page_count', 'comment_count',
    'pub_date', 'update_date', 'likes', 'views',
    'authors', 'works', 'actors', 'tags'
];
JMComicPlugin.DEFAULT_DESCRIPTIONS = {
    id: "ID",
    name: "标题",
    page_count: "页数",
    comment_count: "评论数",
    pub_date: "发布日期",
    update_date: "更新日期",
    likes: "喜欢数",
    views: "浏览数",
    authors: "作者",
    works: "作品",
    actors: "角色",
    tags: "标签"
};
