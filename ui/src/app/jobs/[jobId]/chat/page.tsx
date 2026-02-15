import { ChatInterface } from "./chat-interface";
// import { jobClient } from "@/lib/grpc-client"; // We might need to verify job exists?
// Actually we can just render the interface. The interface handles logic.

export default function ChatPage({ params }: { params: { jobId: string } }) {
    return (
        <div className="container mx-auto py-6 h-[calc(100vh-4rem)]">
            <h1 className="text-2xl font-bold mb-4">Job Chatroom</h1>
            <ChatInterface jobId={params.jobId} />
        </div>
    );
}
