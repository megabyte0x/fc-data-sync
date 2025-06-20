import { main as update_channel_member_main } from './update_channel_member';
import { main as update_channel_following_main } from './update_channel_following'
import { main as user_migrator_main } from './user_migrator'
import { update_users_embeddings } from './update_embeddings';

async function main() {
    // await update_channel_following_main();
    // await update_channel_member_main();
    // await user_migrator_main();
    await update_users_embeddings();

}

main();