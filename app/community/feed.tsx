"use client";
import React, { useState, useEffect } from "react";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

interface Post {
  _id?: string;
  author: string;
  content: string;
  date: string;
  attachments?: string[];
  likes?: string[];
  replies?: { author: string; content: string; date: string }[];
}

export default function CommunityFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyContent, setReplyContent] = useState("");

  // Fetch posts from backend
  useEffect(() => {
    // Get current user name from localStorage
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        setCurrentUser(user.name || "");
      } catch {}
    }
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community-posts");
      const data = await res.json();
      setPosts(data);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (newPost.trim()) {
      await fetch("/api/community-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: currentUser || "Anonymous", content: newPost, attachments }),
      });
      setNewPost("");
      setAttachments([]);
      fetchPosts();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/community-posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchPosts();
  };

  const handleEdit = async (id: string) => {
    await fetch("/api/community-posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content: editContent }),
    });
    setEditId(null);
    setEditContent("");
    fetchPosts();
  };

  const handleLike = async (id: string) => {
    // Optimistic UI update
    setPosts(posts => posts.map(post => post._id === id && post.likes ? {
      ...post,
      likes: post.likes.includes(currentUser) ? post.likes : [...post.likes, currentUser]
    } : post));
    await fetch("/api/community-posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, like: currentUser }),
    });
    fetchPosts();
  };

  const handleReply = async (id: string) => {
    await fetch("/api/community-posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reply: { author: currentUser, content: replyContent, date: new Date().toISOString() } }),
    });
    setReplyContent("");
    fetchPosts();
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // Show previews using object URLs
      setAttachments(Array.from(files).map((f) => URL.createObjectURL(f)));
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-md mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-emerald-800">Community Feed</h2>
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          className="border border-emerald-300 rounded-lg px-4 py-2 flex-1"
          placeholder="Share something..."
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
        />
        <input type="file" multiple accept="image/*,video/*" onChange={handleAttachment} />
        <button
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
          onClick={handlePost}
        >
          Post
        </button>
      </div>
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2">
          {attachments.map((att, i) => att.match(/image\//) ? (
            <img key={i} src={att} alt="preview" className="w-20 h-20 object-cover rounded" />
          ) : (
            <video key={i} src={att} controls className="w-32 h-20 rounded" />
          ))}
        </div>
      )}
      {loading ? (
        <div className="text-slate-500">Loading posts...</div>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post._id || post.date + post.author} className="border-b border-emerald-50 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-emerald-700">{post.author === currentUser ? "You" : post.author}</span>
                <span className="text-xs text-slate-400">{dayjs(post.date).fromNow()}</span>
                {post.author === currentUser && (
                  <>
                    <button className="ml-2 text-xs text-blue-500" onClick={() => { setEditId(post._id!); setEditContent(post.content); }}>Edit</button>
                    <button className="ml-2 text-xs text-red-500" onClick={() => handleDelete(post._id!)}>Delete</button>
                  </>
                )}
              </div>
              {editId === post._id ? (
                <div className="mb-2">
                  <input className="border px-2 py-1" value={editContent} onChange={e => setEditContent(e.target.value)} />
                  <button className="ml-2 text-xs text-green-600" onClick={() => handleEdit(post._id!)}>Save</button>
                  <button className="ml-2 text-xs text-gray-400" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              ) : (
                <div className="text-slate-700 mb-2">{post.content}</div>
              )}
              {post.attachments && post.attachments.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {post.attachments.map((att, i) => att.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    <img key={i} src={att} alt="attachment" className="w-20 h-20 object-cover rounded" />
                  ) : (
                    <video key={i} src={att} controls className="w-32 h-20 rounded" />
                  ))}
                </div>
              )}
              <div className="flex gap-4 items-center">
                <button className="text-xs text-pink-600" onClick={() => handleLike(post._id!)}>
                  Like ({post.likes?.length || 0})
                </button>
                <button className="text-xs text-emerald-600" onClick={() => setReplyContent(post._id!)}>
                  Reply
                </button>
              </div>
              {replyContent === post._id && (
                <div className="mt-2">
                  <input className="border px-2 py-1" value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Write a reply..." />
                  <button className="ml-2 text-xs text-green-600" onClick={() => handleReply(post._id!)}>Send</button>
                  <button className="ml-2 text-xs text-gray-400" onClick={() => setReplyContent("")}>Cancel</button>
                </div>
              )}
              {post.replies && post.replies.length > 0 && (
                <ul className="mt-2 ml-4 border-l pl-2">
                  {post.replies.map((r, i) => (
                    <li key={i} className="text-xs text-slate-600 mb-1">
                      <span className="font-bold">{r.author === currentUser ? "You" : r.author}</span>: {r.content} <span className="text-slate-400">{dayjs(r.date).fromNow()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      </div>
  );
}
