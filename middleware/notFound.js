const notFound = async (req, res, next) => {
  res.status(404).json({
    status: "fail",
    msg: "EndPoint Not Found",
  });
};

export default notFound;
