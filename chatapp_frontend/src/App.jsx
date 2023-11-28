import { useState } from "react";



{/* We are defining a function ChatApplication() and the rest
of the code will be handled under this function */}

function ChatApplication() {
	
{/* we define a few states for the app.
    message_from_user - this will contain the message from user to AI
	chats - this is an array of messages between AI and user
    botTyping - true means bot is typing otherwise false */}
  
  const [pdf_file_name, setPdfFileName] = useState("");
  const [message_from_user, setUserMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [botTyping, setbotTyping] = useState(false);


  const chat = async (e, message_from_user, pdf_file_name) => {
    e.preventDefault();

    {/* we just return if there is no message from user */}
    if (!message_from_user) return;
    setbotTyping(true);

    let msgs = chats;
	
	{/* specific format to send message to AI */}
    msgs.push({ role: "user", content: message_from_user });
    setChats(msgs);

    {/* clear previous user messages */}
    setUserMessage("");

    /* now post the message to server */
    fetch("http://172.24.215.104:5173/chatapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message_from_user,
		pdf_file_name,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        msgs.push(data.output);
        setChats(msgs);
        setbotTyping(false);
      })
      .catch((error) => {
        console.log(error);
      });
  };


 return (
    <main>
      <h1 class="center">AI chatbot running with Open AI</h1>

      <section>
        {chats && chats.length
          ? chats.map((chat, index) => (
              <p key={index} className={chat.role === "user" ? "user_msg" : ""}>
                <span>
                  <b>{chat.role.toUpperCase()}</b>
                </span>
                <span>:</span>
                <span>{chat.content}</span>
              </p>
            ))
          : ""}
      </section>

      <div className={botTyping ? "" : "hide"}>
        <p>
          <i>{botTyping ? "Bot is typing" : ""}</i>
        </p>
      </div>

{/* Now we are creating a form which will provide user a field to enter
    the message and provide a pdf file. When enter is pressed the chat
	function will be called and both text will be passed as argument */}
      <form id="form" action="" onSubmit={(e) => chat(e, message_from_user, pdf_file_name)}>
        <input
          type="text"
          name="message"
          value={message_from_user}
          placeholder="Ask a question and enter ..."
          onChange={(e) => setUserMessage(e.target.value)}
        /><br></br>
		<input
          type="text"
          name="message1"
          value={pdf_file_name}
          placeholder="Path to pdf file ..."
          onChange={(e) => setPdfFileName(e.target.value)}
        />
		<br></br>
		<input type="submit" />
      </form>
    </main>
  );
}

{/* default function is exported here */}
export default ChatApplication;