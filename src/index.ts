import { main as update_channel_member_main } from './update_channel_member';
import { main as update_channel_following_main } from './update_channel_following'

async function main() {
    await update_channel_following_main();
    await update_channel_member_main();

}

main();