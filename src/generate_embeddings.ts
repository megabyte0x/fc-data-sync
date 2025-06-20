import axios from "axios";
import { User_Profile } from "./types";

// const profile = {
//     bio: "Founder of a Web3 startup. Building on Base. Loves DAOs and open-source.",
//     follower_count: 9000,
//     following_count: 500,
//     channels: ["base", "open-source", "web3", "daos"],
// };

async function generateEmbedding(inputText: string) {
    const body = {
        model: "text-embedding-3-small", // Or "text-embedding-ada-002" for older model
        input: inputText,
        encoding_format: "float",
    };

    try {
        const response = await axios.post("https://api.openai.com/v1/embeddings", body, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
        });

        const data = response.data;

        if (!data || !data.data || !data.data[0]?.embedding) {
            throw new Error("Invalid embedding response");
        }

        return data.data[0].embedding;
    } catch (err) {
        console.error("Error generating embedding:", err);
        return null;
    }
}

async function generateUserEmbeddings(profile: User_Profile): Promise<{ summary: string, embedding: number[] }> {
    try {
        const summary = await getSummaryFromProfile(profile);
        const embedding = await generateEmbedding(summary);
        console.log("Generated for fid", profile.fid);
        return { summary, embedding };
    } catch (err) {
        console.error("Error in analyzeProfileAndEmbed:", err);
        throw err;
    }
}

async function getSummaryFromProfile(profile: User_Profile) {
    const prompt = `
   You are an expert in user behavior analysis on decentralized social platforms like Farcaster. Your task is to deeply analyze a user's activity and generate a structured behavioral fingerprint — a list of 10–15 hyphen-separated keyword pairs that summarize the user’s interests, values, expertise, and social role.
   
   You have access to the following user data:
   - **Bio**: a self-written description of identity, interests, and goals.
   - **Username**: which can imply alignment with specific ideas, brands, or memes.
   - **Follower count**: reflects perceived influence or authority.
   - **Following count**: reflects curiosity, exploration, or selective attention.
   - **Channels**: show which topics the user engages with deeply or supports.
   - **User posts** (casts): can reveal what the user builds, supports, debates, or promotes.
   
   Analyze this information holistically. Pay close attention to:
   - What the user *builds* (e.g., protocols, DAOs, apps)
   - What the user *discusses or supports* (e.g., political ideologies, open-source, network states)
   - What *communities* the user is part of or aspires to lead
   - Indicators of *influence vs. exploration* (e.g., followers vs. following)
   - Recurring themes in the language or focus (AI, art, governance, Base, etc.)
   
   Output a single field: "summary" — a comma-separated list of **12–15** meaningful keyword pairs (each in lowercase-hyphenated format), such as:
   - \`solana-builder\`, \`dao-member\`, \`nft-collector\`, \`base-enthusiast\`, \`longevity-supporter\`, \`decentralized-governance-advocate\`, \`ai-content-curator\`, \`startup-societies-promoter\`, \`open-source-champion\`, \`network-state-strategist\`, etc.
   `;

    const body = {
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are an expert profile analyzer that returns structured behavioral summaries. Return only the comma-separated keyword pairs, nothing else.",
            },
            {
                role: "user",
                content: `${prompt}
                
                Analyze this user profile:
                
                Username: ${profile.user_name}
                Bio: ${profile.bio || 'No bio provided'}
                Follower count: ${profile.follower_count}
                Following count: ${profile.following_count}
                Channels: ${profile.channels?.map(c => c.name || c).join(', ') || 'None'}
                
                Recent posts (limited to first 10):
                ${profile.casts?.slice(0, 10).map(cast => `- ${cast.text}`).join('\n') || 'No posts available'}
                
                Return only a comma-separated list of 12-15 meaningful keyword pairs in lowercase-hyphenated format.`,
            },
        ],
        temperature: 0.3,
        max_tokens: 200,
    };

    try {
        const response = await axios.post("https://api.openai.com/v1/chat/completions", body, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
        });

        const data = response.data;
        const summary = data.choices?.[0]?.message?.content?.trim();

        if (!summary) throw new Error("No summary generated");

        return summary;
    } catch (err) {
        console.error("Error:", err);
        return null;
    }
}

export { generateUserEmbeddings };
