import React from 'react';
import './UserAvatar.css';

const UserAvatar = ({ username }) => {
  if (!username) return <div className="avatar" />;

  const getInitial = () => {
    return username.charAt(0).toUpperCase();
  };

  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      let value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  };

  return (
    <div className="avatar" style={{ backgroundColor: stringToColor(username) }}>
      <span className="avatar-initial">{getInitial()}</span>
    </div>
  );
};
export default UserAvatar;